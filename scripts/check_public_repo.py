"""Check Git's index for accidental private artifacts and common secret patterns.

This is a focused guard, not a comprehensive secret scanner. It inspects staged
content, so an ignored local .env or personal database is never printed/read.
"""

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def main():
    paths = git("ls-files", "-z").decode().split("\0")
    failures = []
    patterns = [
        (
            "private key",
            re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        ),
        ("secret API key", re.compile(r"sb_secret_[A-Za-z0-9_-]{15,}")),
        ("GitHub token", re.compile(r"(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}")),
        (
            "non-example email",
            re.compile(r"[\w.+-]+@(?:gmail|hotmail|outlook|yahoo)\.com", re.I),
        ),
        (
            "service-role JWT",
            re.compile(
                r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"
            ),
        ),
    ]
    for name in filter(None, paths):
        parts = Path(name).parts
        if (
            (name.startswith(".env") and name != ".env.example")
            or any(
                p
                in {".private", ".venv", "node_modules", "__pycache__", "static", "qa"}
                for p in parts
            )
            or (name.startswith("app/data/") and name != "app/data/.gitkeep")
            or re.search(r"\.(?:db|sqlite\w*|zip)(?:-|$)", name)
        ):
            failures.append(f"{name}: private/generated artifact")
            continue
        content = git("show", ":" + name).decode("utf-8", errors="replace")
        for label, pattern in patterns:
            # License authors' public contacts are legitimate attribution.
            if name == "THIRD_PARTY_NOTICES.md" and label == "non-example email":
                continue
            if pattern.search(content):
                failures.append(f"{name}: possible {label}")
    if failures:
        print("\n".join(failures))
        return 1
    print(
        f"Public source check passed: {sum(bool(p) for p in paths)} indexed files; no blocked artifacts or matched secret patterns."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
