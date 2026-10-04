"""API for application packages (one tailored bundle per job version)."""

from fastapi import APIRouter, Depends, HTTPException
from auth import workspace
from db import repo, now
from services import packages
from services.intelligence import dossier
from services.jobs import assess_job

router = APIRouter(prefix="/api", dependencies=[Depends(workspace)])


def _job(job_id):
    job = repo().one("jobs", id=job_id)
    if job is None:
        raise HTTPException(404, "Record not found")
    return job


def _clean(row):
    return {k: v for k, v in row.items() if k != "owner_id"} if row else None


@router.get("/packages")
def list_packages():
    r = repo()
    jobs = {j["id"]: j for j in r.all("jobs")}
    apps = {a["job_id"]: a for a in r.all("applications")}
    newest = {}
    for p in r.all("application_packages", order=["job_id", "-version"]):
        newest.setdefault(p["job_id"], p)
    newest = {k: packages.ensure_checked(v) for k, v in newest.items()}
    out = []
    for job_id, p in newest.items():
        j = jobs.get(job_id, {})
        out.append({
            "job_id": job_id, "title": j.get("title"), "company": j.get("company"),
            "location": j.get("location"), "source": j.get("source"),
            "version": p["version"], "status": p["status"], "package_source": p["source"],
            "fit": (p["content"].get("scores") or {}).get("fit"),
            "ats": (p["content"].get("scores") or {}).get("ats"),
            "errors": p["checks"].get("errors", 0), "warnings": p["checks"].get("warnings", 0),
            "application_status": (apps.get(job_id) or {}).get("status"),
            "follow_up_date": (apps.get(job_id) or {}).get("follow_up_date"),
            "updated_at": p["updated_at"],
        })
    out.sort(key=lambda x: x["updated_at"] or "", reverse=True)
    return {"packages": out, "jobs_without_package": len(jobs) - len(newest)}


@router.get("/jobs/{job_id}/package")
def get_package(job_id: str, version: int | None = None):
    job = _job(job_id)
    r = repo()
    current = packages.ensure_checked(packages.latest(job_id, version))
    if version is not None and current is None:
        raise HTTPException(404, "Package version not found")
    versions = [
        {k: p[k] for k in ("version", "status", "source", "created_at")}
        for p in r.all("application_packages", job_id=job_id, order=["-version"])
    ]
    evidence_ids = set()
    if current:
        c = current["content"]
        res = c.get("resume", {})
        evidence_ids |= set(res.get("summary", {}).get("evidence_ids", []))
        for kind in ("experience", "projects"):
            for item in res.get(kind, []):
                for b in item.get("bullets", []):
                    evidence_ids |= set(b.get("evidence_ids", []))
        for a in c.get("answers", []):
            evidence_ids |= set(a.get("evidence_ids", []))
    from profile_store import get_evidence
    cited = {e["evidence_id"]: {k: e.get(k) for k in (
        "evidence_id", "parent_id", "raw_fact", "metric", "evidence_level", "confidence", "claim_restriction")}
        for e in get_evidence() if e.get("evidence_id") in evidence_ids}
    return {
        "job": {k: v for k, v in job.items() if k != "owner_id"},
        "package": _clean(current),
        "versions": versions,
        "evidence": cited,
        "header": packages.header(),
        "application": _clean(r.one("applications", job_id=job_id)),
    }


@router.post("/jobs/{job_id}/package")
def save_package(job_id: str, payload: packages.PackageIn):
    _job(job_id)
    return _clean(packages.save(job_id, payload.content.model_dump(), payload.source))


@router.post("/jobs/{job_id}/package/draft")
def draft_package(job_id: str):
    """Create a starter package from verbatim evidence (no AI, nothing invented)."""
    job = _job(job_id)
    r = repo()
    if r.one("job_matches", job_id=job_id) is None and job.get("description_raw"):
        assess_job(job)
        job = _job(job_id)
    req = r.all("job_requirements", job_id=job_id)
    matches = r.all("evidence_matches", job_id=job_id, order=["-match_score"])
    match = r.one("job_matches", job_id=job_id) or {}
    parsed = {
        "required": [x["requirement"] for x in req if x["kind"] == "required"],
        "preferred": [x["requirement"] for x in req if x["kind"] == "preferred"],
        "seniority": job.get("seniority"),
    }
    d = dossier(job, parsed, {**match, "evidence_matches": matches})
    content = packages.starter(job, d, match)
    return _clean(packages.save(job_id, content, "evidence-template"))


@router.post("/jobs/{job_id}/package/{version}/approve")
def approve_package(job_id: str, version: int):
    _job(job_id)
    r = repo()
    r.lock_account()
    if packages.latest(job_id, version) is None:
        raise HTTPException(404, "Package version not found")
    r.update("application_packages", {"status": "draft", "updated_at": now()}, job_id=job_id, status="approved")
    r.update("application_packages", {"status": "approved", "updated_at": now()}, job_id=job_id, version=version)
    return _clean(packages.latest(job_id, version))
