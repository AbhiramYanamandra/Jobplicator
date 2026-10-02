"""Send jobs already found by the Claude Indeed connector to Jobplicator.

Usage: python scripts/send_indeed_jobs.py jobs.json
The JSON file contains {"jobs": [{"source_url", "company", "title",
"location", "description_raw", ...}]}. No Indeed page is fetched here.
"""

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/send_indeed_jobs.py jobs.json")
    path = pathlib.Path(sys.argv[1])
    data = json.loads(path.read_text())
    if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
        raise SystemExit("Expected a JSON object with a jobs array")
    token_file = pathlib.Path.home() / ".config/jobplicator/indeed-import-token"
    token = os.getenv("JOBPLICATOR_INDEED_IMPORT_TOKEN") or (
        token_file.read_text().strip() if token_file.exists() else ""
    )
    if len(token) < 32:
        raise SystemExit(f"Missing 32+ character import token in {token_file}")
    url = os.getenv("JOBPLICATOR_URL", "https://jobplicator.onrender.com").rstrip("/")
    if not url.startswith("https://"):
        raise SystemExit("JOBPLICATOR_URL must use HTTPS")
    request = urllib.request.Request(
        url + "/api/integrations/indeed/jobs",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(response.read().decode())
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Import failed ({exc.code}): {exc.read().decode()[:500]}") from None


if __name__ == "__main__":
    main()
