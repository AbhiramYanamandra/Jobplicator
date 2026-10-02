from __future__ import annotations
import json, re
from adapters.safe_http import fetch_public, board_token as validate_token
from adapters.base import JobAdapter, AdapterResult


class GreenhouseAdapter(JobAdapter):
    name = "greenhouse"

    def fetch(self, board_token: str = "", **kwargs):
        if not board_token:
            return AdapterResult(self.name, [], "Provide a Greenhouse board token.")
        board_token = validate_token(board_token)
        url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
        data = json.loads(fetch_public(url, accepted=("application/json",)))
        jobs = []
        for j in data.get("jobs", [])[:100]:
            html = j.get("content", "") or ""
            text = re.sub("<[^>]+>", " ", html)
            jobs.append(
                {
                    "source": "Greenhouse",
                    "source_url": j.get("absolute_url"),
                    "company": board_token.replace("-", " ").title(),
                    "title": j.get("title"),
                    "location": (j.get("location") or {}).get("name", ""),
                    "description_raw": re.sub(r"\s+", " ", text),
                    "posted_at": j.get("updated_at"),
                }
            )
        return AdapterResult(self.name, jobs, f"{len(jobs)} jobs fetched")
