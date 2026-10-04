from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path
import datetime, json, logging, os, secrets
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Body, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from settings import Settings
from auth import User, TokenVerifier, current_user, workspace
from db import make_engine, repo, now, use_repository
from schemas import (
    JobIn,
    ApplicationIn,
    QuestionIn,
    AttemptIn,
    InterviewIn,
    ResumeVersionIn,
    CoverIn,
    OutcomeIn,
    WeightsIn,
    DraftIn,
)
from profile_store import get_profile, get_evidence, save_profile
from services.jobs import add_job, assess_job, score_unscored
from services.intelligence import dossier
from services.v3 import (
    cluster_data,
    analytics_v3,
    skill_intelligence,
    strategy,
    question_stats,
    application_interview_prep,
    scoring_weights,
    weekly_report,
)
from adapters.greenhouse import GreenhouseAdapter
from adapters.lever import LeverAdapter
from adapters.generic_url import GenericURLAdapter
from adapters.registry import ADAPTERS
from package_routes import router as package_router
from urllib.parse import urlsplit
from uuid import UUID

ROOT = Path(__file__).resolve().parent
SCHEMA_REVISION = "0002_application_packages"
log = logging.getLogger("jobplicator")
api = APIRouter(prefix="/api", dependencies=[Depends(workspace)])


def require(name, **filters):
    value = repo().one(name, **filters)
    if value is None:
        raise HTTPException(404, "Record not found")
    return value


def clean(value):
    # Internal ownership is not part of the legacy frontend record format.
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items() if k != "owner_id"}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


@api.get("/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "email": user.email}


@api.get("/profile")
def profile():
    return get_profile()


@api.post("/profile")
def replace_profile(payload: dict = Body(...)):
    try:
        save_profile(payload)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    return {
        "ok": True,
        "message": "Profile saved. Reassess existing jobs to refresh their stored scores.",
    }


@api.get("/evidence")
def evidence(search: str = "", level: str = ""):
    return [
        e
        for e in get_evidence()
        if (not level or e.get("evidence_level") == level)
        and (not search or search.lower() in json.dumps(e).lower())
    ]


@api.get("/jobs")
def jobs(search: str = "", role: str = "", status: str = ""):
    score_unscored()
    return clean(
        [
            j
            for j in repo().jobs()
            if (not role or j["role_family"] == role)
            and (not status or (j["application_status"] or j["status"]) == status)
            and (
                not search
                or search.lower()
                in " ".join(
                    str(j.get(k) or "") for k in ("title", "company", "description_raw")
                ).lower()
            )
        ]
    )


@api.get("/jobs/{job_id}")
def job_detail(job_id: str):
    r = repo()
    j = require("jobs", id=job_id)
    if r.one("job_matches", job_id=job_id) is None and j.get("description_raw"):
        # Jobs inserted directly by the scheduled sync have not been scored yet.
        assess_job(j)
        j = require("jobs", id=job_id)
    req = r.all("job_requirements", job_id=job_id)
    matches = r.all("evidence_matches", job_id=job_id, order=["-match_score"])
    match = r.one("job_matches", job_id=job_id) or {}
    parsed = {
        "required": [x["requirement"] for x in req if x["kind"] == "required"],
        "preferred": [x["requirement"] for x in req if x["kind"] == "preferred"],
        "seniority": j.get("seniority"),
    }
    return clean(
        {
            "job": j,
            "requirements": req,
            "match": match,
            "evidence_matches": matches,
            "dossier": dossier(j, parsed, {**match, "evidence_matches": matches}),
            "application": r.one("applications", job_id=job_id),
            "company": r.one("companies", name=j["company"]),
            "contacts": r.all("contacts", company=j["company"]),
        }
    )


@api.post("/jobs")
def create_job(j: JobIn):
    return {"id": add_job(j.model_dump())}


@api.post("/jobs/{job_id}/recalculate")
def recalculate(job_id: str):
    return assess_job(require("jobs", id=job_id))


@api.post("/jobs/{job_id}/application")
def save_application(job_id: str, payload: ApplicationIn):
    require("jobs", id=job_id)
    r = repo()
    r.lock_account()
    existing = r.one("applications", job_id=job_id)
    values = payload.model_dump()
    values["updated_at"] = now()
    if existing:
        values["applied_at"] = values["applied_at"] or existing["applied_at"]
        r.update("applications", values, id=existing["id"])
        aid = existing["id"]
    else:
        aid = r.insert("applications", {"job_id": job_id, **values})
    r.insert(
        "application_events",
        {"application_id": aid, "event_type": "status", "detail": payload.status},
    )
    return {"ok": True}


@api.get("/applications")
def applications():
    return clean(repo().applications())


@api.get("/applications/{application_id}/history")
def application_history(application_id: int):
    require("applications", id=application_id)
    return clean(
        {
            "events": repo().all(
                "application_events", application_id=application_id, order=["-id"]
            ),
            "outcomes": repo().all(
                "application_outcomes", application_id=application_id, order=["-id"]
            ),
        }
    )


@api.post("/v3/applications/{application_id}/outcome")
def outcome(application_id: int, payload: OutcomeIn):
    require("applications", id=application_id)
    return {
        "id": repo().insert(
            "application_outcomes",
            {
                "application_id": application_id,
                **payload.model_dump(),
                "reason_known": int(payload.reason_known),
            },
        )
    }


@api.post("/jobs/{job_id}/resume-version")
def save_resume(job_id: str, payload: ResumeVersionIn):
    require("jobs", id=job_id)
    return {
        "id": repo().insert(
            "resume_versions",
            {
                "job_id": job_id,
                "name": payload.name,
                "content_json": json.dumps(payload.content),
                "fit_score": payload.fit_score,
            },
        )
    }


@api.post("/jobs/{job_id}/cover-letter")
def save_cover(job_id: str, payload: CoverIn):
    require("jobs", id=job_id)
    r = repo()
    r.lock_account()
    previous = r.all("cover_letters", job_id=job_id, order=["-version"], limit=1)
    version = (previous[0]["version"] if previous else 0) + 1
    return {
        "id": r.insert(
            "cover_letters",
            {"job_id": job_id, "content": payload.content, "version": version},
        ),
        "version": version,
    }


@api.get("/jobs/{job_id}/documents")
def documents(job_id: str):
    require("jobs", id=job_id)
    return clean(
        {
            "resume_versions": repo().all(
                "resume_versions", job_id=job_id, order=["-id"]
            ),
            "cover_letters": repo().all(
                "cover_letters", job_id=job_id, order=["-version"]
            ),
        }
    )


@api.get("/resume-draft")
def draft():
    return clean(
        repo().one("resume_drafts")
        or {"content": None, "revision": 0, "updated_at": None}
    )


@api.post("/resume-draft")
def save_draft(payload: DraftIn):
    validate_draft(payload.content)
    r = repo()
    r.lock_account()
    existing = r.one("resume_drafts")
    revision = existing["revision"] if existing else 0
    if payload.revision != revision:
        raise HTTPException(
            409,
            "The draft was updated elsewhere. Load the latest cloud draft before saving your changes.",
        )
    values = {"content": payload.content, "revision": revision + 1, "updated_at": now()}
    r.upsert("resume_drafts", values, keys=[])
    return values


def validate_draft(content):
    r = content.get("resume")
    contact = content.get("contact", {})
    if (
        not isinstance(r, dict)
        or not isinstance(r.get("summary"), str)
        or not isinstance(r.get("education"), dict)
    ):
        raise HTTPException(422, "Invalid resume draft")
    if not isinstance(contact, dict) or any(
        not isinstance(contact.get(k, ""), str) for k in ("name", "line")
    ):
        raise HTTPException(422, "Invalid contact fields")
    for key in ("skills", "experience", "projects"):
        if not isinstance(r.get(key), list):
            raise HTTPException(422, f"Invalid resume {key}")
    for skill in r["skills"]:
        if not isinstance(skill, dict) or any(
            not isinstance(skill.get(k), str) for k in ("label", "value")
        ):
            raise HTTPException(422, "Invalid skill record")
    if not isinstance(r["education"].get("highlights", []), list):
        raise HTTPException(422, "Invalid education highlights")
    for item in r["experience"] + r["projects"]:
        if not isinstance(item, dict) or not isinstance(item.get("bullets"), list):
            raise HTTPException(422, "Invalid resume item")
        for bullet in item["bullets"]:
            if (
                not isinstance(bullet, dict)
                or not isinstance(bullet.get("text"), str)
                or not isinstance(bullet.get("evidence", []), list)
            ):
                raise HTTPException(422, "Invalid resume bullet")


@api.get("/analytics")
def analytics():
    a = repo().applications()
    perf = analytics_v3()
    return {
        "jobs": len(repo().all("jobs")),
        "applied": sum(
            x["status"]
            in ("applied", "oa", "phone screen", "technical", "final", "offer")
            for x in a
        ),
        "interviews": sum(
            x["status"] in ("phone screen", "technical", "final", "offer") for x in a
        ),
        "offers": sum(x["status"] == "offer" for x in a),
        "role_conversion": [
            {"role_family": p["name"], **p} for p in perf["role_performance"]
        ],
    }


@api.get("/v3/clusters")
def clusters():
    return clean(cluster_data())


@api.get("/v3/analytics")
def analytics3():
    return analytics_v3()


@api.get("/v3/skills")
def skills():
    return skill_intelligence()


@api.get("/v3/strategy")
def strategy3():
    return clean(strategy())


@api.get("/v3/questions")
def questions():
    return clean(question_stats())


@api.post("/v3/coding-questions")
def add_question(payload: QuestionIn):
    values = payload.model_dump(exclude={"companies"})
    values["secondary_topics"] = json.dumps(values["secondary_topics"])
    values["asked_in_real_interview"] = int(
        payload.source_type == "Real interview" and payload.asked_in_real_interview
    )
    qid = repo().insert("coding_questions", values)
    for company in payload.companies:
        values = company.model_dump()
        values["source_type"] = values["source_type"] or payload.source_type
        repo().insert("coding_question_companies", {"question_id": qid, **values})
    return {"id": qid}


@api.post("/v3/coding-questions/{qid}/attempts")
def attempt(qid: int, payload: AttemptIn):
    require("coding_questions", id=qid)
    values = payload.model_dump()
    for k in ("solved", "hint_used", "solved_within_target"):
        values[k] = int(values[k])
    return {
        "id": repo().insert("coding_question_attempts", {"question_id": qid, **values})
    }


@api.get("/v3/interview-questions")
def interviews():
    return clean(repo().all("interview_questions", order=["-id"]))


@api.post("/v3/interview-questions")
def add_interview(payload: InterviewIn):
    return {
        "id": repo().insert(
            "interview_questions",
            {
                **payload.model_dump(),
                "asked_in_real_interview": int(
                    payload.source_type == "Real interview"
                    and payload.asked_in_real_interview
                ),
            },
        )
    }


@api.get("/v3/reminders")
def reminders():
    items = [
        a for a in repo().applications() if a["follow_up_date"] or a["closing_date"]
    ]
    return clean(
        {
            "today": datetime.date.today().isoformat(),
            "items": sorted(
                items, key=lambda a: a["follow_up_date"] or a["closing_date"]
            ),
        }
    )


@api.get("/v3/jobs/{job_id}/interview-prep")
def prep(job_id: str):
    require("jobs", id=job_id)
    return clean(application_interview_prep(job_id))


@api.get("/v3/scoring-weights")
def weights():
    return clean(scoring_weights())


@api.post("/v3/scoring-weights")
def save_weights(payload: WeightsIn):
    return {
        "id": repo().insert(
            "scoring_weight_history",
            {"weights_json": json.dumps(payload.weights), "reason": payload.reason},
        ),
        "weights": payload.weights,
    }


@api.get("/v3/weekly-report")
def report():
    return weekly_report()


@api.post("/v3/weekly-report")
def save_report():
    report = weekly_report()
    return {
        "id": repo().insert(
            "weekly_reports",
            {"week_start": report["week_start"], "content_json": json.dumps(report)},
        ),
        **report,
    }


@api.get("/adapters")
def adapters(request: Request):
    registry = {k: dict(v) for k, v in ADAPTERS.items()}
    if not request.app.state.settings.enable_generic_import:
        registry["generic_url"] = {
            "status": "Disabled by default",
            "notes": "Public URL imports require ENABLE_GENERIC_URL_IMPORT=true; board imports remain available.",
        }
    return registry


@api.get("/ingestion")
def imports():
    return clean(repo().all("ingestion_runs", order=["-created_at"], limit=20))


@api.post("/ingest/{adapter}")
def ingest(adapter: str, request: Request, payload: dict = Body(...)):
    r = repo()
    r.lock_account()
    recent = r.all("ingestion_runs", order=["-created_at"], limit=1)
    if recent and datetime.datetime.fromisoformat(recent[0]["created_at"]).replace(
        tzinfo=datetime.timezone.utc
    ) > datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=30):
        raise HTTPException(
            429, "Wait 30 seconds between imports.", headers={"Retry-After": "30"}
        )
    try:
        if adapter == "greenhouse":
            result = GreenhouseAdapter().fetch(
                board_token=payload.get("board_token", "")
            )
        elif adapter == "lever":
            result = LeverAdapter().fetch(
                company_token=payload.get("company_token", "")
            )
        elif adapter == "generic_url":
            if not request.app.state.settings.enable_generic_import:
                raise HTTPException(
                    403,
                    "Public URL import is disabled. Use a board import or paste the posting manually.",
                )
            result = GenericURLAdapter().fetch(
                url=payload.get("url", ""),
                company=payload.get("company", ""),
                title=payload.get("title", ""),
            )
        else:
            raise HTTPException(
                400, "This source requires an authorized connector/provider."
            )
    except (ValueError, OSError) as e:
        raise HTTPException(400, "Import failed: " + str(e)[:300]) from None
    ids = []
    for job in result.jobs[:100]:
        values = {k: v for k, v in job.items() if k in JobIn.model_fields}
        try:
            valid = JobIn.model_validate(values)
        except ValueError:
            continue
        # Nested transaction keeps any malformed upstream item from breaking others.
        with r.connection.begin_nested():
            ids.append(add_job(valid.model_dump()))
    r.insert(
        "ingestion_runs",
        {
            "source": adapter,
            "status": "ok",
            "found_count": len(ids),
            "detail": result.detail,
        },
    )
    return {"source": adapter, "count": len(ids), "ids": ids, "detail": result.detail}


def create_app(settings=None, engine=None, verifier=None):
    settings = settings or Settings.from_env()
    engine = engine or make_engine(settings.database_url, settings.database_sslmode)

    @asynccontextmanager
    async def lifespan(app):
        with engine.connect() as con:
            prefix = "" if engine.dialect.name == "sqlite" else "jobplicator."
            revision = con.execute(
                text(f"SELECT version_num FROM {prefix}alembic_version")
            ).scalar()
            if revision != SCHEMA_REVISION:
                raise RuntimeError("Database migration required: alembic upgrade head")
        yield

    app = FastAPI(
        title="Jobplicator",
        version="4.0.0",
        lifespan=lifespan,
        docs_url=None if settings.environment == "production" else "/docs",
        redoc_url=None,
        openapi_url=None if settings.environment == "production" else "/openapi.json",
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.verifier = verifier or (
        TokenVerifier(settings.supabase_url)
        if settings.auth_mode == "supabase"
        else None
    )

    @app.post("/api/integrations/indeed/jobs")
    def import_indeed_jobs(request: Request, payload: dict = Body(...)):
        """Receive results from the owner's authorised Claude Indeed connector."""
        token = os.getenv("INDEED_IMPORT_TOKEN", "")
        owner = os.getenv("INDEED_IMPORT_OWNER_ID", "")
        supplied = request.headers.get("Authorization", "")
        if not token or len(token) < 32 or not owner:
            raise HTTPException(503, "Indeed bridge is not configured")
        if not supplied.startswith("Bearer ") or not secrets.compare_digest(supplied[7:], token):
            raise HTTPException(401, "Invalid import token")
        try:
            owner = str(UUID(owner))
        except ValueError:
            raise HTTPException(503, "Indeed bridge owner is invalid") from None
        if settings.allowed_user_ids and owner not in settings.allowed_user_ids:
            raise HTTPException(503, "Indeed bridge owner is not allowed")
        items = payload.get("jobs")
        if not isinstance(items, list) or not 1 <= len(items) <= 100:
            raise HTTPException(422, "Provide 1 to 100 jobs")
        validated = []
        for item in items:
            if not isinstance(item, dict):
                raise HTTPException(422, "Each job must be an object")
            url = item.get("source_url", "")
            parsed = urlsplit(url) if isinstance(url, str) else None
            if not parsed or parsed.scheme != "https" or parsed.hostname not in (
                "indeed.com", "www.indeed.com", "au.indeed.com", "sg.indeed.com",
                "to.indeed.com", "au.indeed.com.au", "sg.indeed.com.sg",
            ) or parsed.username or parsed.password:
                raise HTTPException(422, "Each job needs an Indeed HTTPS URL")
            values = {k: v for k, v in item.items() if k in JobIn.model_fields}
            values["source"] = "Indeed"
            try:
                validated.append(JobIn.model_validate(values))
            except ValueError as exc:
                raise HTTPException(422, "Invalid job: " + str(exc)[:300]) from None
        created, skipped = [], 0
        with engine.begin() as connection:
            with use_repository(connection, owner):
                r = repo()
                r.lock_account()
                existing_urls = {j["source_url"] for j in r.all("jobs") if j.get("source_url")}
                for job in validated:
                    if job.source_url in existing_urls:
                        skipped += 1
                        continue
                    created.append(add_job(job.model_dump()))
                    existing_urls.add(job.source_url)
                r.insert("ingestion_runs", {"source": "indeed_connector", "status": "ok", "found_count": len(created), "detail": f"{skipped} duplicate URLs skipped"})
        return {"created": len(created), "skipped": skipped, "ids": created}

    @app.middleware("http")
    async def request_safety(request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 1_048_576:
                    return JSONResponse(
                        {"detail": "Request exceeds 1 MB"}, status_code=413
                    )
            request._body = bytes(body)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(SQLAlchemyError)
    async def db_error(request, exc):
        log.error("Database request failed (%s)", type(exc).__name__)
        return JSONResponse(
            {"detail": "The database request could not be completed. Please retry."},
            status_code=503,
        )

    @app.get("/api/health")
    def health():
        try:
            with engine.connect() as c:
                c.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return JSONResponse({"ok": False}, status_code=503)
        return {"ok": True, "version": "4.0.0", "database": engine.dialect.name}

    @app.get("/api/config")
    def config():
        return {
            "auth_mode": settings.auth_mode,
            "supabase_url": settings.supabase_url,
            "supabase_publishable_key": settings.supabase_publishable_key,
            "environment": settings.environment,
        }

    app.include_router(api)
    app.include_router(package_router)
    static = ROOT / "static"
    app.mount("/static", StaticFiles(directory=static, check_dir=False), name="static")

    @app.get("/")
    def home():
        if not (static / "index.html").exists():
            return JSONResponse(
                {"detail": "Build the frontend: npm --prefix frontend run build"},
                status_code=503,
            )
        return FileResponse(static / "index.html")

    return app
