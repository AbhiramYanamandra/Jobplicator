from uuid import uuid4
from db import repo, now
from services.intelligence import parse_job, score_job


def assess_job(job):
    parsed = parse_job(job)
    score = score_job(job, parsed)
    r = repo()
    jid = job["id"]
    r.delete("job_requirements", job_id=jid)
    r.delete("evidence_matches", job_id=jid)
    for kind in ("required", "preferred"):
        for requirement in parsed[kind]:
            r.insert(
                "job_requirements",
                {
                    "job_id": jid,
                    "requirement": requirement,
                    "kind": kind,
                    "weight": 1.0 if kind == "required" else 0.45,
                    "category": "technical",
                },
            )
    for evidence in score["evidence_matches"]:
        r.insert("evidence_matches", {"job_id": jid, **evidence})
    r.upsert(
        "job_matches",
        {
            "job_id": jid,
            **{k: v for k, v in score.items() if k != "evidence_matches"},
            "rationale": "Evidence-weighted estimate; not a hiring probability.",
            "updated_at": now(),
        },
        keys=["job_id"],
    )
    r.update(
        "jobs",
        {
            "role_family": parsed["role_family"],
            "seniority": parsed["seniority"],
            "updated_at": now(),
        },
        id=jid,
    )
    return score


def add_job(values):
    job = {
        "source": "Manual",
        "description_raw": "",
        **values,
        "id": "JOB-" + uuid4().hex.upper(),
    }
    job["seniority"] = parse_job(job)["seniority"]
    repo().insert("jobs", job)
    assess_job(job)
    return job["id"]
