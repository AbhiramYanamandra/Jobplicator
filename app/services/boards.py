"""Company job boards (Greenhouse / Lever) synced by the backend.

Only public board APIs are used. Results are filtered to early-career
technical roles in Australia, Singapore or remote, de-duplicated against jobs
already tracked, then scored like any other job.
"""

from __future__ import annotations
import re
from datetime import datetime, timedelta, timezone
from adapters.greenhouse import GreenhouseAdapter
from adapters.lever import LeverAdapter
from adapters.safe_http import board_token
from db import repo, now
from schemas import JobIn
from services.jobs import add_job

ADAPTERS = {"greenhouse": GreenhouseAdapter, "lever": LeverAdapter}
# Public boards of companies hiring engineers in Australia. Tokens are from the
# companies' public Greenhouse/Lever URLs; a board that disappears just reports
# an error on sync.
SUGGESTED = [
    {"adapter": "greenhouse", "token": "cultureamp", "label": "Culture Amp"},
    {"adapter": "greenhouse", "token": "easygo", "label": "Easygo"},
    {"adapter": "greenhouse", "token": "optiverprivate", "label": "Optiver"},
    {"adapter": "greenhouse", "token": "sonderaustralia", "label": "Sonder"},
    {"adapter": "lever", "token": "megaport", "label": "Megaport"},
    {"adapter": "lever", "token": "upguard", "label": "UpGuard"},
    {"adapter": "lever", "token": "myob-2", "label": "MYOB"},
]
EARLY = re.compile(r"\b(graduate|grad|junior|jr|entry[- ]level|new grad|intern|internship|early[- ]career|associate|trainee|cadet)\b", re.I)
SENIOR = re.compile(r"\b(senior|sr|staff|principal|lead|manager|director|head|architect)\b", re.I)
TECH = re.compile(r"\b(engineer|engineering|developer|software|firmware|embedded|hardware|electronics?|fpga|data|machine learning|ml|ai|systems|test|qa|devops|platform|backend|frontend|full[- ]stack)\b", re.I)
PLACE = re.compile(r"\b(australia|sydney|melbourne|brisbane|adelaide|canberra|perth|hobart|singapore|nsw|vic|qld|anz|apac|remote)\b", re.I)
STALE_AFTER = timedelta(hours=20)


def relevant(job: dict) -> bool:
    title = job.get("title") or ""
    return bool(EARLY.search(title) and TECH.search(title) and not SENIOR.search(title)
                and PLACE.search(job.get("location") or ""))


def _key(company, title, location):
    norm = lambda v: re.sub(r"[^a-z0-9]+", " ", (v or "").lower()).strip()
    return norm(company), norm(title), norm(location)


def add_watch(adapter: str, token: str, label: str):
    if adapter not in ADAPTERS:
        raise ValueError("Board type must be greenhouse or lever")
    token = board_token(token.strip())
    label = (label or token.replace("-", " ").title()).strip()[:100]
    r = repo()
    if r.one("board_watch", adapter=adapter, token=token):
        return
    r.insert("board_watch", {"adapter": adapter, "token": token, "label": label})


def last_sync():
    stamps = [w["last_synced_at"] for w in repo().all("board_watch") if w["last_synced_at"]]
    return max(stamps) if stamps else None


def is_stale():
    stamp = last_sync()
    if not stamp:
        return True
    when = datetime.fromisoformat(stamp)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - when > STALE_AFTER


def sync(fetchers=None):
    """Fetch every watched board. `fetchers` lets tests inject fake adapters."""
    fetchers = fetchers or ADAPTERS
    r = repo()
    r.lock_account()
    existing = r.all("jobs")
    seen_urls = {j["source_url"] for j in existing if j.get("source_url")}
    seen_keys = {_key(j["company"], j["title"], j.get("location")) for j in existing}
    summary = []
    created_total = 0
    for w in r.all("board_watch", order=["id"]):
        try:
            kwargs = {"board_token" if w["adapter"] == "greenhouse" else "company_token": w["token"]}
            result = fetchers[w["adapter"]]().fetch(**kwargs)
            fetched = result.jobs
            matched = [j for j in fetched if relevant(j)]
            created = 0
            for j in matched:
                values = {k: v for k, v in j.items() if k in JobIn.model_fields}
                values["company"] = w["label"]
                values["source"] = f"{w['adapter'].title()} board"
                if not values.get("description_raw"):
                    values["description_raw"] = values.get("title", "")
                key = _key(values["company"], values.get("title"), values.get("location"))
                if values.get("source_url") in seen_urls or key in seen_keys:
                    continue
                try:
                    job = JobIn.model_validate(values).model_dump()
                except ValueError:
                    continue
                with r.connection.begin_nested():
                    add_job(job)
                created += 1
                seen_urls.add(job.get("source_url"))
                seen_keys.add(key)
            message = f"{len(fetched)} listed, {len(matched)} early-career matches, {created} new"
        except Exception as exc:  # network, 404 board, bad JSON
            created = 0
            message = "Error: " + str(exc)[:200]
        r.update("board_watch", {"last_synced_at": now(), "last_result": message}, id=w["id"])
        summary.append({"label": w["label"], "result": message})
        created_total += created
    if summary:
        r.insert("ingestion_runs", {"source": "company boards", "status": "ok", "found_count": created_total,
                                    "detail": "; ".join(f"{s['label']}: {s['result']}" for s in summary)[:2000]})
    return {"created": created_total, "boards": summary}
