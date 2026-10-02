from conftest import OWNER_A, OWNER_B
from db import use_repository, repo


def test_indeed_bridge_auth_dedup_and_owner(client, engine, monkeypatch):
    token = "a" * 48
    monkeypatch.setenv("INDEED_IMPORT_TOKEN", token)
    monkeypatch.setenv("INDEED_IMPORT_OWNER_ID", OWNER_B)
    path = "/api/integrations/indeed/jobs"
    payload = {"jobs": [{
        "source_url": "https://to.indeed.com/abc123",
        "company": "Example Robotics",
        "title": "Graduate Engineer",
        "location": "Sydney",
        "description_raw": "Build robotics software with Python.",
    }]}
    assert client.post(path, json=payload).status_code == 401
    headers = {"Authorization": "Bearer " + token}
    first = client.post(path, json=payload, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["created"] == 1
    again = client.post(path, json=payload, headers=headers)
    assert again.status_code == 200
    assert again.json()["skipped"] == 1
    assert not any(j["source_url"] == payload["jobs"][0]["source_url"] for j in client.get("/api/jobs").json())
    with engine.begin() as connection:
        with use_repository(connection, OWNER_B):
            jobs = repo().all("jobs", source_url=payload["jobs"][0]["source_url"])
            assert len(jobs) == 1 and jobs[0]["source"] == "Indeed"


def test_indeed_bridge_rejects_non_indeed_urls(client, monkeypatch):
    monkeypatch.setenv("INDEED_IMPORT_TOKEN", "a" * 48)
    monkeypatch.setenv("INDEED_IMPORT_OWNER_ID", OWNER_A)
    response = client.post(
        "/api/integrations/indeed/jobs",
        headers={"Authorization": "Bearer " + "a" * 48},
        json={"jobs": [{"source_url": "https://evil.example/jobs", "company": "Example", "title": "Engineer", "description_raw": "Details"}]},
    )
    assert response.status_code == 422
