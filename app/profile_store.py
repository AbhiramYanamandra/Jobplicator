from copy import deepcopy
from db import repo, now

PROFILE_LISTS = (
    "profile",
    "experiences",
    "projects",
    "evidence",
    "skills",
    "metrics",
    "star_stories",
    "coursework",
    "sources",
    "conflicts",
    "role_mapping",
)


def empty_profile():
    return {"version": "2.0", **{k: [] for k in PROFILE_LISTS}}


def validate_profile(content):
    if not isinstance(content, dict):
        raise ValueError("Career profile must be a JSON object")
    out = empty_profile()
    for key in PROFILE_LISTS:
        values = content.get(key, [])
        if not isinstance(values, list) or any(not isinstance(x, dict) for x in values):
            raise ValueError(f"{key} must be an array of records")
        if len(values) > 5000:
            raise ValueError(f"{key} contains too many records")
        out[key] = values
    for row in out["profile"]:
        if not isinstance(row.get("Field"), str) or not isinstance(
            row.get("Value"), str
        ):
            raise ValueError("Profile records need Field and Value strings")
    for group, key in [
        ("evidence", "evidence_id"),
        ("projects", "project_id"),
        ("experiences", "experience_id"),
    ]:
        ids = [r.get(key) for r in out[group]]
        if any(not isinstance(x, str) or not x.strip() for x in ids) or len(
            set(ids)
        ) != len(ids):
            raise ValueError(f"{group} must have unique {key} strings")
    for e in out["evidence"]:
        if not isinstance(e.get("raw_fact"), str):
            raise ValueError("Each evidence record needs a raw_fact string")
        for key in (
            "action",
            "result",
            "metric",
            "technologies",
            "competencies",
            "role_tags",
            "claim_restriction",
            "evidence_level",
        ):
            if e.get(key) is not None and not isinstance(e[key], str):
                raise ValueError(f"Evidence {key} must be text")
    return out


def get_profile():
    r = repo()
    if not hasattr(r, "profile_cache"):
        record = r.one("profiles")
        r.profile_cache = record["content"] if record else empty_profile()
    return r.profile_cache


def save_profile(content):
    content = validate_profile(content)
    repo().upsert("profiles", {"content": content, "updated_at": now()}, keys=[])
    repo().profile_cache = content
    return content


def get_evidence():
    return get_profile()["evidence"]


def profile_value(field, default=""):
    return next(
        (
            x.get("Value", default)
            for x in get_profile()["profile"]
            if x.get("Field", "").lower() == field.lower()
        ),
        default,
    )
