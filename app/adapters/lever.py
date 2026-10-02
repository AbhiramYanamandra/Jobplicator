from __future__ import annotations
import json, re
from adapters.safe_http import fetch_public, board_token as validate_token
from adapters.base import JobAdapter, AdapterResult


class LeverAdapter(JobAdapter):
    name = "lever"

    def fetch(self, company_token: str = "", **kwargs):
        if not company_token:
            return AdapterResult(self.name, [], "Provide a Lever company token.")
        company_token = validate_token(company_token)
        url = f"https://api.lever.co/v0/postings/{company_token}?mode=json"
        data = json.loads(fetch_public(url, accepted=("application/json",)))
        jobs = []
        for j in data[:100]:
            cats = j.get("categories") or {}
            text = " ".join(
                [
                    j.get("descriptionPlain", "") or "",
                    *(x.get("content", "") for x in j.get("lists", [])),
                ]
            )
            jobs.append(
                {
                    "source": "Lever",
                    "source_url": j.get("hostedUrl"),
                    "company": company_token.replace("-", " ").title(),
                    "title": j.get("text"),
                    "location": cats.get("location", ""),
                    "work_mode": cats.get("commitment", ""),
                    "description_raw": re.sub(r"\s+", " ", text),
                }
            )
        return AdapterResult(self.name, jobs, f"{len(jobs)} jobs fetched")
