from __future__ import annotations
import re, html
from adapters.safe_http import fetch_public
from adapters.base import JobAdapter, AdapterResult


class GenericURLAdapter(JobAdapter):
    name = "generic_url"

    def fetch(self, url: str = "", company: str = "", title: str = "", **kwargs):
        if not url:
            return AdapterResult(self.name, [], "Provide a public job URL.")
        raw = fetch_public(url)
        # conservative readable-text extraction; does not bypass auth or anti-bot controls
        raw = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", raw)
        text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw))
        text = re.sub(r"\s+", " ", text).strip()
        if not title:
            m = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw)
            title = re.sub("<[^>]+>", " ", m.group(1)).strip() if m else "Imported job"
        return AdapterResult(
            self.name,
            [
                {
                    "source": "Public URL",
                    "source_url": url,
                    "company": company or "Company not set",
                    "title": title,
                    "description_raw": text[:50000],
                }
            ],
            "Fetched public page text.",
        )
