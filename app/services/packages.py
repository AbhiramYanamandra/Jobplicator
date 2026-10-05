"""Application packages: one tailored, evidence-grounded bundle per job version.

A package holds the tailored resume, cover letter, application answers and
outreach for one job. Every resume bullet and answer cites evidence_ids from
the career evidence database; `verify` re-checks a package against that
database so unsupported claims are flagged instead of silently saved.
"""

from __future__ import annotations
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from db import repo, now
from profile_store import get_profile, profile_value


class _M(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Cited(_M):
    text: str = Field(default="", max_length=2000)
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)


class Skill(_M):
    label: str = Field(max_length=100)
    value: str = Field(max_length=1000)


class Item(_M):
    parent_id: str = Field(default="", max_length=100)
    title: str = Field(default="", max_length=300)
    org: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=200)
    dates: str = Field(default="", max_length=100)
    mark: str = Field(default="", max_length=50)  # projects: course/thesis mark, e.g. "89 HD"
    bullets: list[Cited] = Field(default_factory=list, max_length=12)


class Highlight(_M):
    text: str = Field(default="", max_length=300)
    dates: str = Field(default="", max_length=100)
    evidence_ids: list[str] = Field(default_factory=list, max_length=10)


class Education(_M):
    institution: str = Field(default="", max_length=300)
    degree: str = Field(default="", max_length=300)
    dates: str = Field(default="", max_length=100)
    details: str = Field(default="", max_length=1000)  # right of the degree line, e.g. "Honours WAM: 74.5"
    highlights: list[Highlight] = Field(default_factory=list, max_length=8)


class Resume(_M):
    variant: str = Field(default="", max_length=100)
    tagline: Cited = Field(default_factory=Cited)
    summary: Cited = Field(default_factory=Cited)
    skills: list[Skill] = Field(default_factory=list, max_length=12)
    education: Education = Field(default_factory=Education)
    experience: list[Item] = Field(default_factory=list, max_length=10)
    projects: list[Item] = Field(default_factory=list, max_length=10)


class Answer(_M):
    question: str = Field(max_length=500)
    answer: str = Field(default="", max_length=4000)
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)


class Outreach(_M):
    hiring_manager: str = Field(default="", max_length=300)
    linkedin_query: str = Field(default="", max_length=300)
    linkedin_message: str = Field(default="", max_length=600)
    email: str = Field(default="", max_length=3000)


class Scores(_M):
    fit: int | None = Field(default=None, ge=0, le=100)
    ats: int | None = Field(default=None, ge=0, le=100)
    summary: str = Field(default="", max_length=2000)
    strengths: list[str] = Field(default_factory=list, max_length=12)
    gaps: list[str] = Field(default_factory=list, max_length=12)


class PackageContent(_M):
    scores: Scores = Field(default_factory=Scores)
    resume: Resume = Field(default_factory=Resume)
    cover_letter: str = Field(default="", max_length=12000)
    answers: list[Answer] = Field(default_factory=list, max_length=20)
    outreach: Outreach = Field(default_factory=Outreach)
    notes: str = Field(default="", max_length=4000)


class PackageIn(_M):
    content: PackageContent
    source: Literal["manual", "evidence-template", "claude"] = "manual"


# --- verification -----------------------------------------------------------

NUMBER = re.compile(
    r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s*(%|x\b|ms\b|us\b|µs|pp\b|k\b|s\b|secs?\b|seconds?\b|mins?\b|minutes?\b"
    r"|h\b|hrs?\b|hours?\b|days?\b|weeks?\b|months?\b|units?\b|times\b|engineers?\b|users?\b|people\b)?",
    re.I,
)
STOP = {"claim", "claims", "keywords", "etc", "the", "and", "with", "for", "vs", "use"}


def _norm(s):
    return re.sub(r"\s+", " ", str(s or "").lower())


def plain(text):
    """Text without the resume's **bold** and ^superscript^ markup."""
    return str(text or "").replace("**", "").replace("^", "")


def _academic_text(profile):
    """Facts education lines may draw on: profile fields, coursework, roles."""
    parts = [f"{x.get('Field')} {x.get('Value')}" for x in profile.get("profile", [])]
    parts += [f"{c.get('course')} {c.get('result')}" for c in profile.get("coursework", [])]
    parts += [f"{x.get('role')} {x.get('organisation')} {x.get('summary')}" for x in profile.get("experiences", [])]
    parts += [f"{x.get('project')} {x.get('course_or_context')}" for x in profile.get("projects", [])]
    return _norm(" ".join(parts)).replace(",", "")


def _evidence_text(e):
    return _norm(" ".join(str(e.get(k, "")) for k in (
        "raw_fact", "metric", "result", "action", "context", "technologies", "notes")))


def _numbers(text):
    out = []
    for m in NUMBER.finditer(text or ""):
        value = m.group(1).replace(",", "")
        # Single digits and years are rarely the claims worth checking.
        if len(value.replace(".", "")) < 2 and not m.group(2):
            continue
        if re.fullmatch(r"(19|20)\d\d", value):
            continue
        out.append(value)
    return out


def _restricted_claims(profile):
    """Sub-claims from Restricted conflicts, minus org/project names.

    'Redback lap time claim' becomes ['lap', 'time']; a line containing all of a
    sub-claim's words is flagged. One-word sub-claims are skipped as too broad
    unless hyphenated (e.g. 'low-power')."""
    names = set()
    for x in profile.get("experiences", []):
        names |= set(_norm(x.get("organisation")).split())
    for x in profile.get("projects", []):
        names |= set(_norm(x.get("project")).split())
    out = []
    for c in profile.get("conflicts", []):
        if "restricted" not in _norm(c.get("status")):
            continue
        for part in re.split(r"[/]", c.get("field_or_claim", "")):
            words = [w for w in re.findall(r"[a-z0-9+%-]+", _norm(part))
                     if w not in STOP and w not in names and len(w.strip("+%")) > 1]
            if len(words) >= 2 or (len(words) == 1 and "-" in words[0]):
                out.append((c, words))
    return out


def _stem(w):
    return w[:-1] if w.endswith("s") and len(w) > 3 else w


def _known_skill_text(profile):
    parts = [str(s.get("skill", "")) for s in profile.get("skills", [])]
    parts += [str(e.get("technologies", "")) for e in profile.get("evidence", [])]
    parts += [str(x.get("technologies", "")) for x in profile.get("experiences", []) + profile.get("projects", [])]
    return _norm(" ; ".join(parts))


def verify(content: dict, profile: dict | None = None) -> dict:
    """Return {"flags": [...], "errors": n, "warnings": n, "checked_at": iso}."""
    profile = profile or get_profile()
    evidence = {e["evidence_id"]: e for e in profile.get("evidence", []) if e.get("evidence_id")}
    parents = {x.get("experience_id") for x in profile.get("experiences", [])} | {
        x.get("project_id") for x in profile.get("projects", [])}
    metrics_by_parent = {}
    for m in profile.get("metrics", []):
        metrics_by_parent.setdefault(m.get("parent_id"), []).append(m)
    flags = []
    restricted = _restricted_claims(profile)

    def flag(severity, where, message):
        flags.append({"severity": severity, "where": where, "message": message})

    academic = _academic_text(profile)

    def check_academic(where, text):
        """Education lines and project marks: numbers must be in the profile/coursework."""
        for n in _numbers(plain(text)):
            if not re.search(r"(?<![\d.])" + re.escape(n) + r"(?![\d])", academic):
                flag("error", where, f"Number '{n}' is not in your profile or coursework results.")

    def check_cited(where, text, ids, required=True):
        text = plain(text)
        if not (text or "").strip():
            return
        if not ids:
            if required:
                flag("warning", where, "No evidence cited for this line.")
            return
        cited = []
        for i in ids:
            if i in evidence:
                cited.append(evidence[i])
            elif i not in parents:
                flag("error", where, f"Cites unknown evidence '{i}'.")
        pool = " ".join(_evidence_text(e) for e in cited)
        for e in cited:
            pool += " " + " ".join(_norm(f"{m.get('value')} {m.get('context')}") for m in metrics_by_parent.get(e.get("parent_id"), []))
        pool_nums = pool.replace(",", "")
        for n in _numbers(text):
            if not re.search(r"(?<![\d.])" + re.escape(n) + r"(?![\d])", pool_nums):
                flag("error", where, f"Number '{n}' does not appear in the cited evidence.")
        lowered = _norm(text)
        tokens = {_stem(t) for t in re.findall(r"[a-z0-9+%-]+", lowered)}
        for c, words in restricted:
            if all((_stem(w) in tokens) or (w.replace("-", " ") in lowered) for w in words):
                flag("error", where, f"Matches restricted claim {c.get('conflict_id')} ({c.get('field_or_claim')}): {c.get('recommended_canonical')}.")
        for e in cited:
            restriction = (e.get("claim_restriction") or "").lower()
            if "team result" in restriction and "team" not in lowered:
                flag("warning", where, f"{e['evidence_id']} is a team result; say so in the wording.")
            if re.fullmatch(r"do not use\.?( by default\.?)?", restriction.strip()):
                flag("error", where, f"{e['evidence_id']} is restricted: {e.get('claim_restriction')}")
            elif restriction.startswith("do not") or "use only if" in restriction:
                # Scoped restriction ("Do not claim exact time saving..."): a person must judge it.
                flag("warning", where, f"{e['evidence_id']}: {e.get('claim_restriction')}")

    resume = content.get("resume", {})
    summary = resume.get("summary", {})
    check_cited("Resume summary", summary.get("text"), summary.get("evidence_ids", []), required=False)
    tagline = resume.get("tagline", {})
    check_cited("Resume tagline", tagline.get("text"), tagline.get("evidence_ids", []), required=False)
    education = resume.get("education", {})
    check_academic("Education", f"{education.get('degree', '')} {education.get('details', '')}")
    for i, h in enumerate(education.get("highlights", [])):
        if h.get("evidence_ids"):
            check_cited(f"Education · highlight {i + 1}", h.get("text"), h["evidence_ids"], required=False)
        else:
            check_academic(f"Education · highlight {i + 1}", h.get("text"))
    for kind in ("experience", "projects"):
        for i, item in enumerate(resume.get(kind, [])):
            label = item.get("title") or item.get("org") or f"{kind} {i + 1}"
            if item.get("parent_id") and item["parent_id"] not in parents:
                flag("error", label, f"Unknown experience/project '{item['parent_id']}'.")
            if item.get("mark"):
                check_academic(label, item["mark"])
            for j, b in enumerate(item.get("bullets", [])):
                check_cited(f"{label} · bullet {j + 1}", b.get("text"), b.get("evidence_ids", []))
    known = _known_skill_text(profile)
    for s in resume.get("skills", []):
        for token in re.split(r"[;,]", plain(s.get("value", ""))):
            t = token.strip()
            core = _norm(re.sub(r"\(.*?\)", "", t)).strip()
            if core and core not in known:
                flag("error", f"Skills · {s.get('label')}", f"'{t}' is not supported by the evidence database.")
    for i, a in enumerate(content.get("answers", [])):
        check_cited(f"Answer {i + 1}", a.get("answer"), a.get("evidence_ids", []), required=False)
    errors = sum(f["severity"] == "error" for f in flags)
    return {"flags": flags, "errors": errors, "warnings": len(flags) - errors, "checked_at": now()}


# --- storage ----------------------------------------------------------------


def latest(job_id, version=None):
    r = repo()
    if version is not None:
        return r.one("application_packages", job_id=job_id, version=version)
    rows = r.all("application_packages", job_id=job_id, order=["-version"], limit=1)
    return rows[0] if rows else None


def ensure_checked(row):
    """Normalise a stored package and run checks if the writer left them pending.

    The scheduled Claude generator writes rows straight into the database with
    checks {"pending": true}; the authoritative evidence check runs here, the
    first time the site reads the row. Malformed generator output is reported
    as a check error instead of breaking the page."""
    if not row:
        return row
    row = dict(row)
    try:
        normalised = PackageContent.model_validate(row["content"]).model_dump()
        problem = None
    except Exception as exc:  # pydantic.ValidationError, TypeError for non-dicts
        normalised = PackageContent(notes="The generated package could not be read; regenerate it.").model_dump()
        problem = str(exc).splitlines()[0][:300]
    checks = row.get("checks") or {}
    if checks.get("pending") or "flags" not in checks:
        if problem:
            checks = {"flags": [{"severity": "error", "where": "Package",
                                 "message": f"Generated package does not match the expected format: {problem}"}],
                      "errors": 1, "warnings": 0, "checked_at": now()}
        else:
            checks = verify(normalised)
        repo().update("application_packages", {"checks": checks}, id=row["id"])
        row["checks"] = checks
        if row.get("source") == "claude":
            # Close any request this generated package answered, in case the
            # generator did not mark it done itself.
            for q in repo().all("package_requests", job_id=row["job_id"], status="pending"):
                if (q["created_at"] or "") <= (row.get("created_at") or ""):
                    repo().update("package_requests", {"status": "done", "done_at": now()}, id=q["id"])
    row["content"] = normalised
    return row


def save(job_id, content: dict, source: str):
    r = repo()
    r.lock_account()
    previous = latest(job_id)
    version = (previous["version"] if previous else 0) + 1
    checks = verify(content)
    stamp = now()
    r.insert("application_packages", {
        "job_id": job_id, "version": version, "status": "draft", "source": source,
        "content": content, "checks": checks, "created_at": stamp, "updated_at": stamp,
    })
    return latest(job_id, version)


def header():
    """Contact header comes only from the canonical profile, never generated text."""
    return {k: profile_value(f) for k, f in (
        ("name", "Name"), ("email", "Email"), ("phone", "Phone"), ("location", "Location"),
        ("work_rights", "Work rights"), ("licence", "Driver licence"),
        ("github", "GitHub"), ("linkedin", "LinkedIn"), ("website", "Website"),
        ("degree", "Degree"), ("study_period", "Study period"),
        ("wam", "WAM"), ("honours_wam", "Honours WAM"))}


def wam_line(h):
    if h.get("honours_wam"):
        return f"Honours WAM: {h['honours_wam']}"
    return f"WAM: {h['wam']}" if h.get("wam") else ""


def _starter_highlights(profile):
    """Thesis mark plus the strongest design-project marks, verbatim from coursework."""
    out = []
    for c in profile.get("coursework", []):
        course, result = str(c.get("course", "")), str(c.get("result", ""))
        if not re.fullmatch(r"\d{2,3} (HD|DN)", result):
            continue
        name = course.split(" / ")[0]
        if "thesis" in name.lower() or "design" in name.lower():
            out.append({"text": f"{name} \u2013 **{result}**", "dates": "", "evidence_ids": []})
    return out[:4]


# --- deterministic evidence-only starter draft --------------------------------

MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def _month(value):
    m = re.fullmatch(r"(\d{4})-(\d{2})", str(value or ""))
    return f"{MONTHS[int(m.group(2)) - 1]} {m.group(1)}" if m else str(value or "")


def _role_mapping(profile, role_family):
    key = (role_family or "").split("/")[0].strip().lower().split(" ")[0]
    maps = profile.get("role_mapping", [])
    for m in maps:
        if m.get("role_family", "").lower().startswith(key) and key:
            return m
    return next((m for m in maps if m.get("role_family", "").lower().startswith("software")), maps[0] if maps else {})


def _ids(text):
    return [x.strip() for x in str(text or "").split(";") if x.strip()]


def _usable(e):
    r = (e.get("claim_restriction") or "").lower()
    return not ("team result" in r or r.startswith("do not") or "do not use" in r or "use only if" in r)


def starter(job: dict, dossier: dict, match: dict) -> dict:
    """Build a package using only verbatim evidence. No invented wording."""
    profile = get_profile()
    mapping = _role_mapping(profile, job.get("role_family"))
    evidence = profile.get("evidence", [])
    strong_ids = {m.get("evidence_id") for m in dossier.get("strong", []) if m.get("evidence_id")}
    exps = {x["experience_id"]: x for x in profile.get("experiences", [])}
    projs = {x["project_id"]: x for x in profile.get("projects", [])}
    parents = _ids(mapping.get("priority_evidence")) + _ids(mapping.get("secondary_evidence"))
    if not parents:
        # No role mapping: lead with parents of the strongest matching evidence.
        ordered = sorted(evidence, key=lambda e: e.get("evidence_id") not in strong_ids)
        parents = list(dict.fromkeys(e.get("parent_id") for e in ordered if e.get("parent_id")))
    experience, projects = [], []
    for pid in parents:
        rows = [e for e in evidence if e.get("parent_id") == pid and _usable(e)]
        rows.sort(key=lambda e: (e["evidence_id"] not in strong_ids, e.get("confidence") != "high"))
        bullets = [{"text": e["raw_fact"], "evidence_ids": [e["evidence_id"]]} for e in rows[:3]]
        if not bullets:
            continue
        if pid in exps and len(experience) < 3:
            x = exps[pid]
            experience.append({"parent_id": pid, "title": x.get("role", ""), "org": x.get("organisation", ""),
                               "location": x.get("location", ""),
                               "dates": f"{_month(x.get('start'))} – {_month(x.get('end'))}", "bullets": bullets})
        elif pid in projs and len(projects) < 3:
            x = projs[pid]
            projects.append({"parent_id": pid, "title": x.get("project", ""), "org": x.get("course_or_context", ""),
                             "location": "", "dates": "", "bullets": bullets})
    surface = [s.strip() for s in str(mapping.get("skills_to_surface", "")).split(";") if s.strip()]
    known = _known_skill_text(profile)
    surface = [s for s in surface if _norm(s) in known]
    h = header()
    content = {
        "scores": {"fit": match.get("career_fit"), "ats": None,
                   "summary": "Keyword fit only. Use \"Ask AI to write this package\" for an ATS score and tailored writing.",
                   "strengths": [m["requirement"] for m in dossier.get("strong", [])][:8],
                   "gaps": [g["requirement"] for g in dossier.get("gaps", [])][:8]},
        "resume": {
            "variant": mapping.get("role_family", ""),
            "summary": {"text": profile_value("Primary positioning"), "evidence_ids": []},
            "skills": [{"label": "Relevant", "value": "; ".join(surface)}] if surface else [],
            "education": {"institution": "University of New South Wales, Sydney, NSW" if "UNSW" in h["degree"] else "",
                          "degree": h["degree"].replace(", UNSW Sydney", ""),
                          "dates": h["study_period"], "details": wam_line(h),
                          "highlights": _starter_highlights(profile)},
            "experience": experience, "projects": projects,
        },
        "cover_letter": dossier.get("cover_letter", ""),
        "answers": [{"question": q["question"], "answer": q["draft"], "evidence_ids": []}
                    for q in dossier.get("application_questions", [])],
        "outreach": {"hiring_manager": "Not confirmed",
                     "linkedin_query": f"{job.get('company', '')} engineering manager {job.get('location', '')}".strip(),
                     "linkedin_message": dossier.get("outreach", "")[:600], "email": ""},
        "notes": "Starter draft built only from verbatim evidence. Rewrite wording freely; keep the evidence citations.",
    }
    return PackageContent.model_validate(content).model_dump()
