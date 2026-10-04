from __future__ import annotations
import re, math, json, urllib.parse
from services.career import search_evidence, skill_supported, safe_evidence
from profile_store import get_profile, get_evidence, profile_value

SKILL_PATTERNS = [
    "C++",
    "C",
    "Python",
    "STM32",
    "FreeRTOS",
    "CAN",
    "Linux",
    "VHDL",
    "Verilog",
    "FPGA",
    "React",
    "TypeScript",
    "JavaScript",
    "AWS",
    "Docker",
    "OpenCV",
    "PyTorch",
    "SQL",
    "Git",
    "I2C",
    "SPI",
    "UART",
    "BLE",
    "MATLAB",
    "Jira",
    "Confluence",
    "Vitis HLS",
    "AUTOSAR",
    "MISRA",
    "CI/CD",
    "Kubernetes",
    "Terraform",
    "REST",
    "Node.js",
    "Next.js",
    "Playwright",
    "Cypress",
]
ROLE_MAP = [
    (
        "Embedded / Firmware",
        ["embedded", "firmware", "microcontroller", "stm32", "rtos"],
    ),
    ("FPGA / Digital Systems", ["fpga", "vhdl", "verilog", "rtl", "hls"]),
    (
        "ML / Computer Vision",
        ["machine learning", "computer vision", "pytorch", "opencv", "ai engineer"],
    ),
    (
        "Software / Full-stack",
        [
            "software engineer",
            "developer",
            "frontend",
            "full stack",
            "full-stack",
            "react",
            "typescript",
        ],
    ),
    ("Data / Analytics", ["data analyst", "analytics", "power bi", "sql"]),
    ("Test / QA", ["test engineer", "qa", "verification", "validation"]),
]


def parse_job(job):
    text = ((job.get("title") or "") + " " + (job.get("description_raw") or "")).lower()
    role = "General Engineering"
    for r, keys in ROLE_MAP:
        if any(k in text for k in keys):
            role = r
            break
    seniority = (
        "Graduate / Entry Level"
        if any(k in text for k in ["graduate", "entry level", "junior", "0-2 years"])
        else "Experienced"
    )
    req = []
    pref = []
    for skill in SKILL_PATTERNS:
        s = skill.lower()
        if re.search(r"(?i)\b" + re.escape(s) + r"\b", text) or s in text:
            window = text[max(0, text.find(s) - 120) : text.find(s) + 160]
            target = (
                pref
                if any(
                    k in window
                    for k in ["preferred", "nice to have", "desirable", "bonus"]
                )
                else req
            )
            if skill not in target:
                target.append(skill)
    # capture bullets after requirement-like phrases
    return {
        "role_family": role,
        "seniority": seniority,
        "required": req,
        "preferred": pref,
    }


def _evidence_for_requirement(req):
    ev = skill_supported(req)
    if not ev:
        ev = search_evidence(req, 5)
    return ev


def score_job(job, requirements):
    allr = [(r, "required", 1.0) for r in requirements.get("required", [])] + [
        (r, "preferred", 0.45) for r in requirements.get("preferred", [])
    ]
    if not allr:
        allr = [("Computer Engineering", "required", 1.0)]
    evidence_rows = []
    earned = 0
    total = 0
    for r, kind, w in allr:
        total += w
        ev = _evidence_for_requirement(r)
        good = [e for e in ev if safe_evidence(e)]
        if good:
            direct = any(
                r.lower()
                in (
                    " "
                    + str(e.get("technologies", "")).lower()
                    + " "
                    + str(e.get("raw_fact", "")).lower()
                )
                for e in good
            )
            s = 1.0 if direct else 0.72
            earned += w * s
            evidence_rows.append(
                {
                    "requirement": r,
                    "evidence_id": good[0]["evidence_id"],
                    "match_type": "direct" if direct else "supporting",
                    "match_score": s,
                    "reason": good[0]["raw_fact"],
                }
            )
        else:
            evidence_rows.append(
                {
                    "requirement": r,
                    "evidence_id": None,
                    "match_type": "unsupported",
                    "match_score": 0,
                    "reason": "No verified supporting evidence in the career database.",
                }
            )
    technical = 100 * earned / max(total, 1)
    edu = 100 if profile_value("Degree") else 0
    loc = (
        100
        if profile_value("Location")
        and (
            profile_value("Location").lower() in (job.get("location") or "").lower()
            or "remote" in (job.get("location") or "").lower()
        )
        else 70
    )
    exp = (
        92
        if requirements.get("seniority", "").startswith("Graduate")
        or (job.get("seniority") or "").startswith("Graduate")
        else 68
    )
    career = round(0.55 * technical + 0.15 * edu + 0.1 * loc + 0.2 * exp)
    resume = max(45, round(career - 14))
    potential = min(98, round(career + 2))
    recency = 85
    priority = round(0.7 * career + 0.2 * recency + 0.1 * loc)
    return {
        "career_fit": career,
        "resume_fit": resume,
        "potential_fit": potential,
        "priority_score": priority,
        "evidence_matches": evidence_rows,
    }


def dossier(job, reqs, score):
    matches = score["evidence_matches"]
    strong = [m for m in matches if m["match_score"] >= 0.7]
    gaps = [m for m in matches if not m["evidence_id"]]
    top_ids = [m["evidence_id"] for m in strong[:4] if m["evidence_id"]]
    evmap = {e["evidence_id"]: e for e in get_evidence()}
    top = [evmap[x] for x in top_ids if x in evmap]
    company = job.get("company") or "the company"
    title = job.get("title") or "the role"
    strengths = (
        "; ".join(e["raw_fact"] for e in top[:2])
        or "Add relevant, verified career evidence to personalize this section."
    )
    gaptext = (
        ", ".join(g["requirement"] for g in gaps[:4])
        or "No major verified evidence gaps identified."
    )
    cover = f"""Dear Hiring Team,\n\nI am applying for the {title} position at {company}. My background includes {profile_value("Primary positioning", "the experience outlined in my resume")}. I would welcome the opportunity to discuss its relevance to your team.\n\nIn particular, {strengths}\n\nI am drawn to this opportunity because it would let me apply that practical engineering experience in a production environment while continuing to develop in the areas central to the role. I would welcome the opportunity to discuss how my background could contribute to {company}.\n\nKind regards,\n{profile_value("Name", "Your name")}"""
    outreach = f"Hi — I recently came across the {title} role at {company}. My background includes {', '.join([m['requirement'] for m in strong[:3]]) or 'computer engineering, embedded systems and software'}. I’m planning to apply and would love to connect and learn more about the team."
    interview = []
    for m in strong[:3]:
        interview.append(
            f"Tell us about a time you used {m['requirement']} in a real project."
        )
    for g in gaps[:2]:
        interview.append(
            f"You have limited direct evidence for {g['requirement']}. How would you ramp up quickly?"
        )
    interview += [
        "Walk me through the technical project you are most proud of.",
        "Tell me about a difficult debugging problem and how you isolated the root cause.",
    ]
    people = [
        {
            "type": "Hiring manager",
            "name": "Not confirmed",
            "confidence": "Unverified",
            "reason": "Needs live public-source enrichment.",
            "search_url": "https://www.linkedin.com/search/results/people/?keywords="
            + urllib.parse.quote(f"{company} {title} engineering manager"),
        },
        {
            "type": "Recruiter / Talent",
            "name": "Not confirmed",
            "confidence": "Unverified",
            "reason": "Needs live public-source enrichment.",
            "search_url": "https://www.linkedin.com/search/results/people/?keywords="
            + urllib.parse.quote(f"{company} recruiter talent acquisition"),
        },
    ]
    # Evidence-backed resume plan: promote role-relevant parents and explicitly block unsupported gaps.
    parent_scores = {}
    for m in strong:
        if not m.get("evidence_id"):
            continue
        ev = evmap.get(m["evidence_id"])
        if ev:
            parent_scores[ev.get("parent_id", "")] = parent_scores.get(
                ev.get("parent_id", ""), 0
            ) + m.get("match_score", 0)
    ranked_parents = [
        x[0]
        for x in sorted(parent_scores.items(), key=lambda kv: kv[1], reverse=True)
        if x[0]
    ]
    resume_plan = {
        "headline": f"Tailor toward {job.get('role_family') or title}",
        "priority_parents": ranked_parents[:5],
        "skills_to_surface": [m["requirement"] for m in strong[:8]],
        "do_not_add": [g["requirement"] for g in gaps[:8]],
        "bullet_rewrites": [
            {
                "evidence_id": e["evidence_id"],
                "suggestion": (e.get("action") or e.get("raw_fact", "")).strip()
                + ((" — " + e.get("result", "").strip()) if e.get("result") else ""),
            }
            for e in top[:4]
        ],
    }
    # STAR story selection from the master database.
    stars = []
    role_words = " ".join(
        [job.get("role_family") or "", title, job.get("description_raw") or ""]
    ).lower()
    for st in get_profile().get("star_stories", []):
        txt = (
            " ".join(
                str(st.get(k, ""))
                for k in ["skills", "situation", "task", "action", "result"]
            )
        ).lower()
        score = sum(
            1
            for w in [
                "leadership",
                "debug",
                "research",
                "testing",
                "embedded",
                "fpga",
                "software",
                "machine learning",
                "team",
            ]
            if w in role_words and w in txt
        )
        stars.append((score, st))
    stars = [s for _, s in sorted(stars, key=lambda x: x[0], reverse=True)[:4]]
    app_questions = [
        {
            "question": "Why are you interested in this role?",
            "draft": f"The {title} role interests me because of its focus on {', '.join([m['requirement'] for m in strong[:3]]) or 'engineering projects'}. I am particularly interested in applying that experience in {company}'s environment while continuing to grow in the core technologies of the role.",
        },
        {
            "question": "Why this company?",
            "draft": f"I am interested in {company} because the role combines practical engineering ownership with the technical areas I have developed through university and industry projects. I would tailor this further once company/product intelligence is enriched from public sources.",
        },
        {
            "question": "Tell us about a relevant project.",
            "draft": top[0]["raw_fact"]
            if top
            else "Select the highest-ranked evidence item from the dossier and expand it using the STAR story panel.",
        },
    ]
    follow_up = {
        "after_apply": "Send a concise recruiter/hiring-manager connection note within 1–2 business days if a relevant public contact is identified.",
        "no_response": "Follow up once after roughly 5–7 business days unless the posting gives a different timeline.",
        "interview": "Send a short thank-you note within 24 hours, referencing one technical discussion point.",
    }
    return {
        "top_evidence": top,
        "strong": strong,
        "gaps": gaps,
        "cover_letter": cover,
        "outreach": outreach,
        "interview_questions": interview,
        "people": people,
        "gap_summary": gaptext,
        "resume_plan": resume_plan,
        "star_stories": stars,
        "application_questions": app_questions,
        "follow_up": follow_up,
    }
