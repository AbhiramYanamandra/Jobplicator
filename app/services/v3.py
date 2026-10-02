from __future__ import annotations
import math, re, json, hashlib, datetime
from collections import Counter, defaultdict
from db import all_rows, one_row, list_jobs, list_applications
from profile_store import get_evidence

ROLE_CENTERS = {
    "Embedded / Firmware": (-0.62, -0.05),
    "FPGA / Hardware": (-0.35, 0.58),
    "FPGA / Digital Systems": (-0.35, 0.58),
    "ML / Computer Vision": (0.30, 0.58),
    "Software / Full-stack": (0.62, 0.02),
    "Backend": (0.48, -0.28),
    "Data / Analytics": (0.10, -0.58),
    "Cloud / DevOps": (0.63, -0.48),
    "Test / QA": (-0.08, -0.62),
    "Graduate Generalist": (0.0, 0.0),
    "General Engineering": (0.0, 0.0),
}
STOP = set(
    "the and or to a of in for with on is are as an be this that from using use work working experience preferred required desirable strong role engineer engineering graduate".split()
)


def toks(s):
    return {
        x
        for x in re.findall(r"[a-z0-9+#.]+", (s or "").lower())
        if len(x) > 2 and x not in STOP
    }


def similarity(a, b):
    A = toks(
        (a.get("title") or "")
        + " "
        + (a.get("description_raw") or "")
        + " "
        + (a.get("role_family") or "")
    )
    B = toks(
        (b.get("title") or "")
        + " "
        + (b.get("description_raw") or "")
        + " "
        + (b.get("role_family") or "")
    )
    if not A or not B:
        return 0
    return len(A & B) / math.sqrt(len(A) * len(B))


def _jitter(key):
    h = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    return ((h % 1000) / 1000 - 0.5) * 0.24, (((h // 1000) % 1000) / 1000 - 0.5) * 0.24


def cluster_data():
    js = list_jobs()
    nodes = []
    for j in js:
        cx, cy = ROLE_CENTERS.get(j.get("role_family") or "Graduate Generalist", (0, 0))
        dx, dy = _jitter(j["id"])
        nodes.append({**j, "x": cx + dx, "y": cy + dy})
    edges = []
    for i in range(len(js)):
        scores = []
        for k in range(len(js)):
            if i == k:
                continue
            s = similarity(js[i], js[k])
            if s >= 0.20:
                scores.append((s, js[k]["id"]))
        for s, jid in sorted(scores, reverse=True)[:3]:
            if js[i]["id"] < jid:
                edges.append(
                    {"source": js[i]["id"], "target": jid, "similarity": round(s, 3)}
                )
    summary = []
    by = defaultdict(list)
    for j in js:
        by[j.get("role_family") or "Other"].append(j)
    for role, arr in by.items():
        apps = [x for x in arr if x.get("application_status")]
        ints = [
            x
            for x in arr
            if (x.get("application_status") or "").lower()
            in ("phone screen", "technical", "final", "offer", "oa")
        ]
        skills = []
        for x in arr:
            skills += [
                r["requirement"] for r in all_rows("job_requirements", job_id=x["id"])
            ]
        top = [k for k, v in Counter(skills).most_common(5)]
        gaps = []
        for x in arr:
            gaps += [
                r["requirement"]
                for r in [
                    e
                    for e in all_rows("evidence_matches", job_id=x["id"])
                    if not e["evidence_id"]
                ]
            ]
        summary.append(
            {
                "role_family": role,
                "job_count": len(arr),
                "avg_fit": round(
                    sum((x.get("career_fit") or 0) for x in arr) / len(arr), 1
                ),
                "applications": len(apps),
                "interviews": len(ints),
                "top_skills": top,
                "top_gaps": [k for k, v in Counter(gaps).most_common(4)],
            }
        )
    return {
        "nodes": nodes,
        "edges": edges,
        "clusters": sorted(summary, key=lambda x: x["job_count"], reverse=True),
    }


def analytics_v3():
    apps = list_applications()
    stages = [
        "saved",
        "shortlisted",
        "tailoring",
        "ready",
        "applied",
        "oa",
        "phone screen",
        "technical",
        "final",
        "offer",
        "rejected",
        "withdrawn",
    ]
    rank = {s: i for i, s in enumerate(stages)}
    funnel = []
    for s in ["applied", "oa", "phone screen", "technical", "final", "offer"]:
        idx = rank[s]
        funnel.append(
            {
                "stage": s,
                "count": sum(
                    1
                    for a in apps
                    if rank.get((a.get("status") or "saved").lower(), 0) >= idx
                    and (a.get("status") or "").lower() not in ("rejected", "withdrawn")
                ),
            }
        )

    def group(field):
        d = defaultdict(list)
        for a in apps:
            d[a.get(field) or "Other"].append(a)
        out = []
        for k, arr in d.items():
            interviews = sum(
                1
                for a in arr
                if (a.get("status") or "").lower()
                in ("phone screen", "technical", "final", "offer")
            )
            offers = sum(1 for a in arr if (a.get("status") or "").lower() == "offer")
            out.append(
                {
                    "name": k,
                    "applications": len(arr),
                    "interviews": interviews,
                    "offers": offers,
                    "screen_rate": round(100 * interviews / max(len(arr), 1), 1),
                    "avg_fit": round(
                        sum((a.get("career_fit") or 0) for a in arr) / max(len(arr), 1),
                        1,
                    ),
                    "signal": "Insufficient data"
                    if len(arr) < 5
                    else ("Early signal" if len(arr) < 15 else "Moderate signal"),
                }
            )
        return sorted(
            out, key=lambda x: (x["interviews"], x["applications"]), reverse=True
        )

    return {
        "applications": len(apps),
        "funnel": funnel,
        "role_performance": group("role_family"),
        "source_performance": group("source"),
    }


def skill_intelligence():
    reqs = all_rows("job_requirements")
    total = max(len(set(r["job_id"] for r in reqs)), 1)
    by = defaultdict(lambda: {"jobs": set(), "required": 0, "preferred": 0})
    for r in reqs:
        z = by[r["requirement"]]
        z["jobs"].add(r["job_id"])
        z[r["kind"]] += 1
    evidence_text = " ".join(
        " ".join(
            str(e.get(k, ""))
            for k in ["raw_fact", "technologies", "competencies", "role_tags"]
        )
        for e in get_evidence()
    ).lower()
    out = []
    for skill, z in by.items():
        ev = "Strong" if skill.lower() in evidence_text else "None"
        demand = 100 * len(z["jobs"]) / total
        gap = (
            "High"
            if ev == "None" and (z["required"] >= 2 or demand >= 25)
            else ("Medium" if ev == "None" else "None")
        )
        action = (
            "Learn / build evidence"
            if gap == "High"
            else ("Monitor" if gap == "Medium" else "Surface existing evidence")
        )
        out.append(
            {
                "skill": skill,
                "jobs": len(z["jobs"]),
                "demand_pct": round(demand, 1),
                "required": z["required"],
                "preferred": z["preferred"],
                "evidence": ev,
                "gap": gap,
                "action": action,
            }
        )
    return sorted(
        out, key=lambda x: (x["gap"] == "High", x["required"], x["jobs"]), reverse=True
    )


def strategy():
    jobs = list_jobs()
    apply = [
        j
        for j in jobs
        if not j.get("application_status") and (j.get("priority_score") or 0) >= 70
    ][:5]
    follow = [j for j in jobs if j.get("application_status") and j.get("next_action")][
        :5
    ]
    skills = [x for x in skill_intelligence() if x["gap"] == "High"][:5]
    roleperf = analytics_v3()["role_performance"]
    focus = (
        roleperf[0]["name"]
        if roleperf and roleperf[0]["applications"] >= 5
        else (
            apply[0].get("role_family") if apply else "Build more application history"
        )
    )
    return {
        "apply_now": apply,
        "follow_ups": follow,
        "skill_focus": skills,
        "role_focus": focus,
        "observed": "Recommendations combine fit, priority, tracked application history and current skill demand.",
        "confidence": "Early signal"
        if sum(x["applications"] for x in roleperf) < 15
        else "Moderate signal",
    }


def question_stats():
    qs = all_rows("coding_questions", order=["-id"])
    attempts = all_rows("coding_question_attempts", order=["-attempted_at"])
    amap = defaultdict(list)
    for a in attempts:
        amap[a["question_id"]].append(a)
    crows = all_rows("coding_question_companies", order=["-id"])
    cmap = defaultdict(list)
    for c in crows:
        cmap[c["question_id"]].append(c)
    topics = defaultdict(lambda: {"attempted": 0, "solved": 0})
    diff = Counter()
    for q in qs:
        q["companies"] = cmap[q["id"]]
        q["attempts"] = amap[q["id"]]
        diff[q.get("difficulty") or "Unknown"] += 1
        t = q.get("primary_topic") or "Other"
        topics[t]["attempted"] += len(amap[q["id"]])
        topics[t]["solved"] += sum(1 for a in amap[q["id"]] if a.get("solved"))
    counts = Counter(
        (c["company"], q.get("primary_topic")) for q in qs for c in q["companies"]
    )
    companies = [
        {"company": c, "primary_topic": t, "count": n} for (c, t), n in counts.items()
    ]
    return {
        "questions": qs,
        "difficulty": dict(diff),
        "topic_readiness": [
            {
                "topic": k,
                **v,
                "rate": round(100 * v["solved"] / max(v["attempted"], 1), 1),
            }
            for k, v in topics.items()
        ],
        "company_topics": companies,
    }


def application_interview_prep(job_id):
    j = one_row("jobs", id=job_id) or {}
    req = [x["requirement"] for x in all_rows("job_requirements", job_id=job_id)]
    q = question_stats()["questions"]
    company = [
        x
        for x in q
        if any(
            c.get("company", "").lower() == j.get("company", "").lower()
            for c in x.get("companies", [])
        )
    ]
    topic_tokens = " ".join(req).lower()
    topic_map = {
        "graphs": ["graph", "bfs", "dfs"],
        "dynamic programming": ["dp", "dynamic"],
        "arrays / hashing": ["array", "hash"],
        "sliding window": ["string", "window"],
        "trees": ["tree"],
        "binary search": ["binary search"],
        "intervals": ["interval"],
    }
    relevant = []
    for x in q:
        t = (x.get("primary_topic") or "").lower()
        if any(k in topic_tokens for k in topic_map.get(t, [])):
            relevant.append(x)
    practice = []
    seen = set()
    for x in company + relevant + q:
        if x["id"] not in seen:
            practice.append(x)
            seen.add(x["id"])
        if len(practice) >= 8:
            break
    return {
        "job": j,
        "company_tagged": company[:5],
        "recommended_set": practice,
        "requirements": req[:12],
        "note": "Company-tagged prep is kept distinct from questions confirmed as asked in a real interview.",
    }


def scoring_weights():
    base = {
        "technical_skills": 30,
        "evidence_relevance": 20,
        "domain_relevance": 15,
        "preferred_skills": 10,
        "education": 10,
        "experience_level": 5,
        "location_work_rights": 5,
        "ats_terminology": 5,
    }
    history = all_rows("scoring_weight_history", order=["-id"], limit=10)
    hist = history[0] if history else None
    return {
        "current": json.loads(hist["weights_json"]) if hist else base,
        "source": "learned-history" if hist else "transparent baseline",
        "history": history,
    }


def weekly_report():
    an = analytics_v3()
    st = strategy()
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    return {
        "week_start": monday.isoformat(),
        "applications": an["applications"],
        "top_role": st["role_focus"],
        "apply_now": len(st["apply_now"]),
        "follow_ups": len(st["follow_ups"]),
        "skill_focus": [x["skill"] for x in st["skill_focus"][:3]],
        "signal": st["confidence"],
    }
