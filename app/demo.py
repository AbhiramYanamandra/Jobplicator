"""Explicit fictional test/demo data. Never runs on application startup."""

import json
from pathlib import Path
from db import repo, now
from profile_store import save_profile
from services.jobs import add_job


def seed_demo():
    if repo().all("jobs", limit=1):
        raise ValueError("Demo seed requires an empty workspace")
    profile = json.loads(
        (
            Path(__file__).resolve().parents[1] / "examples/career_profile.json"
        ).read_text()
    )
    save_profile(profile)
    for title, description in [
        ("Graduate Software Engineer", "Python React TypeScript SQL testing required"),
        ("Embedded Engineer", "C++ STM32 FreeRTOS debugging required"),
    ]:
        add_job(
            {
                "company": "Example Labs (fictional)",
                "title": title,
                "location": "Example City",
                "source": "Fictional demo",
                "description_raw": description,
            }
        )
    for title, difficulty, topic, source in [
        ("Two Sum", "Easy", "Arrays", "General practice"),
        ("Number of Islands", "Medium", "Graphs", "Company-tagged prep"),
    ]:
        q = repo().insert(
            "coding_questions",
            {
                "title": title,
                "platform": "LeetCode",
                "difficulty": difficulty,
                "primary_topic": topic,
                "source_type": source,
                "secondary_topics": "[]",
            },
        )
        if source == "Company-tagged prep":
            repo().insert(
                "coding_question_companies",
                {
                    "question_id": q,
                    "company": "Example Labs (fictional)",
                    "role": "Graduate",
                    "interview_stage": "OA",
                    "source_type": source,
                    "confidence": "Reported",
                },
            )
    resume = {
        "education": {
            "institution": "Example University",
            "location": "Example City",
            "degree": "BSc Computer Science",
            "details": "",
            "dates": "2020–2024",
            "highlights": [],
        },
        "summary": "Software engineer working with Python and React.",
        "skills": [{"label": "Programming", "value": "Python, React, SQL"}],
        "experience": [
            {
                "id": "demo-exp",
                "parentId": "EXP-DEMO",
                "role": "Software Engineer",
                "org": "Example Labs (fictional)",
                "location": "Example City",
                "dates": "2024–2025",
                "bullets": [
                    {
                        "text": "Built a Python reporting tool for a sample dataset.",
                        "evidence": ["DEMO-01"],
                    }
                ],
            }
        ],
        "projects": [
            {
                "id": "demo-project",
                "parentId": "PRJ-DEMO",
                "title": "Demo Search Tool",
                "subtitle": "Sample project",
                "dates": "2024",
                "bullets": [
                    {
                        "text": "Built a searchable demo interface in React.",
                        "evidence": ["DEMO-02"],
                    }
                ],
            }
        ],
    }
    repo().upsert(
        "resume_drafts",
        {
            "content": {
                "resume": resume,
                "contact": {"name": "Alex Example", "line": "alex@example.test"},
            },
            "revision": 1,
            "updated_at": now(),
        },
        keys=[],
    )
