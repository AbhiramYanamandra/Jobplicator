"""Collect licenses from the locked, installed frontend runtime dependencies."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
frontend = ROOT / "frontend"
lock = json.loads((frontend / "package-lock.json").read_text())
sections = [
    "# Third-party frontend notices\n\nNotices from installed production dependencies. Run `npm ci` and then `python3 scripts/update_notices.py` after updating dependencies.\n"
]
for name, record in sorted(lock["packages"].items()):
    if not name or record.get("dev"):
        continue
    folder = frontend / name
    if not (folder / "package.json").exists():
        continue
    package = json.loads((folder / "package.json").read_text())
    licenses = sorted(
        p
        for p in folder.iterdir()
        if p.is_file() and p.name.lower().startswith(("license", "licence", "copying"))
    )
    text = "\n\n".join(p.read_text(errors="replace") for p in licenses)
    if not text:
        text = f"License: {package.get('license', record.get('license', 'See package repository'))}\nRepository: {package.get('repository', 'See package metadata')}"
    sections.append(
        f"## {package['name']} {package['version']}\n\n```text\n{text.strip()}\n```\n"
    )
output = "\n".join(sections)
(ROOT / "THIRD_PARTY_NOTICES.md").write_text(
    "\n".join(line.rstrip() for line in output.splitlines()) + "\n"
)
print(f"Collected {len(sections) - 1} runtime dependency notices.")
