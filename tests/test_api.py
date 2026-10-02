import json
import pytest
from conftest import OWNER_A, OWNER_B
from db import use_repository
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from models import TABLES

READ_ROUTES = [
    "/api/profile",
    "/api/jobs",
    "/api/evidence",
    "/api/applications",
    "/api/analytics",
    "/api/adapters",
    "/api/ingestion",
    "/api/v3/clusters",
    "/api/v3/analytics",
    "/api/v3/skills",
    "/api/v3/strategy",
    "/api/v3/questions",
    "/api/v3/interview-questions",
    "/api/v3/reminders",
    "/api/v3/scoring-weights",
    "/api/v3/weekly-report",
    "/api/resume-draft",
]


@pytest.mark.parametrize("path", READ_ROUTES)
def test_read_routes_and_auth(client, path):
    assert client.get(path).status_code == 200
    client.headers.pop("Authorization")
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", READ_ROUTES)
def test_second_account_starts_empty(client, path):
    client.headers["Authorization"] = "Bearer bob"
    r = client.get(path)
    assert r.status_code == 200
    body = json.dumps(r.json())
    assert (
        "Alex Example" not in body
        and "DEMO-01" not in body
        and "Example Labs" not in body
        and "Two Sum" not in body
    )


def test_job_crm_documents_and_outcome(client):
    result = client.post(
        "/api/jobs",
        json={
            "company": "Test",
            "title": "Python Engineer",
            "description_raw": "Required Python and SQL",
            "location": "Example City",
        },
    )
    assert result.status_code == 200
    jid = result.json()["id"]
    assert client.get(f"/api/jobs/{jid}").json()["evidence_matches"]
    assert client.post(f"/api/jobs/{jid}/recalculate").status_code == 200
    for status in ["saved", "applied", "technical", "rejected"]:
        assert (
            client.post(
                f"/api/jobs/{jid}/application",
                json={
                    "status": status,
                    "notes": "Keep this",
                    "follow_up_date": "2026-10-10",
                },
            ).status_code
            == 200
        )
    a = next(x for x in client.get("/api/applications").json() if x["job_id"] == jid)
    assert (
        client.post(
            f"/api/v3/applications/{a['id']}/outcome",
            json={
                "reason_category": "Skills",
                "reason_known": True,
                "rejection_stage": "technical",
            },
        ).status_code
        == 200
    )
    history = client.get(f"/api/applications/{a['id']}/history").json()
    assert len(history["events"]) == 4 and history["outcomes"][0]["reason_known"] == 1
    assert (
        client.post(
            f"/api/jobs/{jid}/resume-version",
            json={"name": "Test resume", "content": {"summary": "Supported"}},
        ).status_code
        == 200
    )
    for letter in ["First letter", "Second letter"]:
        assert (
            client.post(
                f"/api/jobs/{jid}/cover-letter", json={"content": letter}
            ).status_code
            == 200
        )
    docs = client.get(f"/api/jobs/{jid}/documents").json()
    assert (
        docs["cover_letters"][0]["version"] == 2
        and docs["resume_versions"][0]["name"] == "Test resume"
    )
    client.headers["Authorization"] = "Bearer bob"
    for path in [
        f"/api/jobs/{jid}",
        f"/api/jobs/{jid}/documents",
        f"/api/v3/jobs/{jid}/interview-prep",
        f"/api/applications/{a['id']}/history",
    ]:
        assert client.get(path).status_code == 404
    for path, payload in [
        (f"/api/jobs/{jid}/application", {}),
        (f"/api/jobs/{jid}/cover-letter", {"content": "Steal"}),
        (f"/api/jobs/{jid}/resume-version", {"content": {}}),
        (f"/api/jobs/{jid}/recalculate", {}),
        (f"/api/v3/applications/{a['id']}/outcome", {}),
    ]:
        assert client.post(path, json=payload).status_code == 404


def test_questions_and_attempts_are_owned(client):
    payload = {
        "title": "Private graph question",
        "difficulty": "Medium",
        "primary_topic": "Graphs",
        "secondary_topics": ["BFS"],
        "source_type": "Company-tagged prep",
        "asked_in_real_interview": False,
        "companies": [
            {
                "company": "Fictional",
                "role": "Graduate",
                "interview_stage": "OA",
                "confidence": "Reported",
            }
        ],
    }
    qid = client.post("/api/v3/coding-questions", json=payload).json()["id"]
    assert (
        client.post(
            f"/api/v3/coding-questions/{qid}/attempts",
            json={
                "solved": True,
                "solved_within_target": True,
                "time_taken_minutes": 12,
            },
        ).status_code
        == 200
    )
    q = next(
        q for q in client.get("/api/v3/questions").json()["questions"] if q["id"] == qid
    )
    assert (
        q["asked_in_real_interview"] == 0
        and q["attempts"][0]["solved_within_target"] == 1
    )
    assert q["companies"][0]["interview_stage"] == "OA"
    client.headers["Authorization"] = "Bearer bob"
    assert (
        client.post(
            f"/api/v3/coding-questions/{qid}/attempts", json={"solved": True}
        ).status_code
        == 404
    )
    assert client.get("/api/v3/questions").json()["questions"] == []


def test_cloud_draft_conflicts_and_isolation(client):
    initial = client.get("/api/resume-draft").json()
    body = initial["content"]
    body["resume"]["summary"] = "Saved on device one"
    response = client.post(
        "/api/resume-draft", json={"content": body, "revision": initial["revision"]}
    )
    assert response.status_code == 200
    assert response.json()["revision"] == initial["revision"] + 1
    assert (
        client.post(
            "/api/resume-draft", json={"content": body, "revision": initial["revision"]}
        ).status_code
        == 409
    )
    assert (
        client.get("/api/resume-draft").json()["content"]["resume"]["summary"]
        == "Saved on device one"
    )
    client.headers["Authorization"] = "Bearer bob"
    assert client.get("/api/resume-draft").json()["content"] is None
    assert (
        client.post(
            "/api/resume-draft", json={"content": {"resume": {}}, "revision": 0}
        ).status_code
        == 422
    )


def test_profile_updates_change_only_owner_scoring(client):
    p = client.get("/api/profile").json()
    p["profile"][0]["Value"] = "Changed Example"
    assert client.post("/api/profile", json=p).status_code == 200
    jid = client.get("/api/jobs").json()[0]["id"]
    assert (
        "Changed Example"
        in client.get(f"/api/jobs/{jid}").json()["dossier"]["cover_letter"]
    )
    client.headers["Authorization"] = "Bearer bob"
    assert client.get("/api/profile").json()["profile"] == []
    assert (
        client.post(
            "/api/profile", json={"evidence": [{"raw_fact": "missing ID"}]}
        ).status_code
        == 422
    )


def test_validation_weights_size_and_config(client):
    assert client.post("/api/jobs", json={"title": "Missing fields"}).status_code == 422
    assert (
        client.post(
            "/api/v3/scoring-weights", json={"weights": {"a": 101}, "reason": "Bad"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v3/scoring-weights",
            json={"weights": {"a": 100}, "reason": "Proposal"},
        ).status_code
        == 200
    )
    assert client.post("/api/v3/weekly-report").status_code == 200
    assert client.post("/api/profile", content=b"x" * 1_048_577).status_code == 413
    config = client.get("/api/config").json()
    assert "database_url" not in config and "allowed_user_ids" not in config
    assert client.get("/api/profile").headers["Cache-Control"] == "no-store"
    client.headers["Authorization"] = "Bearer invalid"
    assert client.get("/api/jobs").status_code == 401


def test_relational_constraints_prevent_cross_account_parent(engine, client):
    q = client.get("/api/v3/questions").json()["questions"][0]["id"]
    with pytest.raises(IntegrityError):
        with engine.begin() as c:
            with use_repository(c, OWNER_B) as r:
                r.insert("coding_question_attempts", {"question_id": q, "solved": 1})


def test_production_fails_closed(monkeypatch):
    from settings import Settings

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_MODE", "local")
    with pytest.raises(ValueError, match="Production requires"):
        Settings.from_env()


def test_allowlist_rejects_uninvited_user(engine, settings):
    from dataclasses import replace
    from app import create_app
    from conftest import FakeVerifier
    from fastapi.testclient import TestClient

    with TestClient(
        create_app(
            replace(settings, allowed_user_ids=frozenset({OWNER_A})),
            engine,
            FakeVerifier(),
        )
    ) as c:
        assert (
            c.get("/api/jobs", headers={"Authorization": "Bearer bob"}).status_code
            == 403
        )


def test_missing_context_cannot_access_data():
    from db import repo

    with pytest.raises(RuntimeError, match="authenticated"):
        repo()
