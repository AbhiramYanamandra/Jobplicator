from __future__ import annotations
import json, pathlib, re
from profile_store import get_profile, get_evidence

ALIASES = {
    "c++": ["c++", "cpp"],
    "c": [" c ", "embedded c", "c programming"],
    "python": ["python"],
    "stm32": ["stm32"],
    "freertos": ["freertos", "rtos"],
    "can": ["can bus", " can "],
    "linux": ["linux", "ubuntu", "bash"],
    "vhdl": ["vhdl"],
    "verilog": ["verilog"],
    "fpga": ["fpga", "vivado", "vitis hls", "basys", "kria"],
    "react": ["react", "react.js"],
    "typescript": ["typescript"],
    "javascript": ["javascript", "node.js", "next.js"],
    "aws": ["aws", "s3"],
    "docker": ["docker"],
    "opencv": ["opencv", "computer vision"],
    "pytorch": ["pytorch", "torch"],
    "sql": ["sql", "database"],
    "git": ["git", "github", "bitbucket"],
    "i2c": ["i2c"],
    "spi": ["spi"],
    "uart": ["uart"],
    "ble": ["ble", "bluetooth"],
    "testing": ["testing", "test", "playwright", "cypress", "verification"],
    "debugging": ["debug", "debugging", "troubleshoot"],
    "embedded systems": ["embedded", "firmware", "microcontroller"],
    "machine learning": ["machine learning", "ml", "deep learning", "yolo", "rt-detr"],
    "computer vision": ["computer vision", "opencv", "yolo", "image processing"],
    "hls": ["hls", "vitis hls"],
    "matlab": ["matlab"],
    "jira": ["jira"],
    "confluence": ["confluence"],
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower())


def evidence_text(e):
    return norm(
        " ".join(
            str(e.get(k, ""))
            for k in [
                "raw_fact",
                "context",
                "action",
                "result",
                "metric",
                "technologies",
                "competencies",
                "role_tags",
                "notes",
            ]
        )
    )


def skill_supported(skill: str):
    q = norm(skill)
    keys = [q]
    for canonical, aliases in ALIASES.items():
        if q == canonical or any(q == a.strip() for a in aliases):
            keys = [canonical] + aliases
    out = []
    for e in get_evidence():
        txt = evidence_text(e)
        if any(k.strip() and k.strip() in txt for k in keys):
            out.append(e)
    return out


def search_evidence(query: str, limit=8):
    terms = [
        t
        for t in re.findall(r"[a-zA-Z0-9+#.\-]{2,}", norm(query))
        if t not in {"and", "the", "for", "with", "from", "using", "experience"}
    ]
    scored = []
    for e in get_evidence():
        txt = evidence_text(e)
        score = sum(
            2 if t in norm(e.get("technologies", "")) else 1 for t in terms if t in txt
        )
        if score:
            strength = {
                "artifact-verified": 1.3,
                "supported": 1.1,
                "resume-supported": 0.85,
            }.get(e.get("evidence_level", ""), 1.0)
            scored.append((score * strength, e))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [e for _, e in scored[:limit]]


def safe_evidence(e):
    r = (e.get("claim_restriction") or "").lower()
    return (
        "do not" not in r
        and "unverified" not in r
        and e.get("evidence_level") not in {"unverified", "skill-only"}
    )
