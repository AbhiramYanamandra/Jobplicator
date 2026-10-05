"""AI package request queue and company job-board sync."""
from adapters.base import AdapterResult
from conftest import OWNER_A


def job(client, title="Embedded Engineer"):
    return client.post("/api/jobs", json={"company": "Example Drones", "title": title,
                                          "location": "Sydney", "description_raw": "C++ and STM32."}).json()["id"]


def test_request_queue_update_cancel_and_listing(client):
    jid = job(client)
    first = client.post(f"/api/jobs/{jid}/package/request", json={"note": "Lead with firmware"}).json()
    assert first["status"] == "pending" and first["note"] == "Lead with firmware"
    again = client.post(f"/api/jobs/{jid}/package/request", json={"note": "Lead with FPGA"}).json()
    assert again["id"] == first["id"] and again["note"] == "Lead with FPGA"
    assert client.get(f"/api/jobs/{jid}/package").json()["request"]["note"] == "Lead with FPGA"
    listing = client.get("/api/packages").json()
    assert [q["job_id"] for q in listing["queued"]] == [jid]
    assert client.post(f"/api/jobs/{jid}/package/request/cancel").json()["ok"]
    assert client.get(f"/api/jobs/{jid}/package").json()["request"] is None
    assert client.get("/api/packages").json()["queued"] == []
    client.headers["Authorization"] = "Bearer bob"
    assert client.post(f"/api/jobs/{jid}/package/request", json={}).status_code == 404


def test_generated_package_closes_its_request(client, engine):
    from sqlalchemy import insert
    from models import TABLES
    jid = job(client)
    client.post(f"/api/jobs/{jid}/package/request", json={"note": "x"})
    with engine.begin() as c:
        c.execute(insert(TABLES["application_packages"]).values(
            owner_id=OWNER_A, job_id=jid, version=1, status="draft", source="claude",
            content={"cover_letter": "Dear Hiring Manager"}, checks={"pending": True},
            created_at="2999-01-01T00:00:00+00:00", updated_at="2999-01-01T00:00:00+00:00"))
    detail = client.get(f"/api/jobs/{jid}/package").json()
    assert detail["package"]["source"] == "claude"
    assert client.get(f"/api/jobs/{jid}/package").json()["request"] is None


class FakeGreenhouse:
    def fetch(self, board_token="", **kw):
        return AdapterResult("greenhouse", [
            {"source": "Greenhouse", "source_url": "https://job-boards.greenhouse.io/ex/jobs/1", "company": "Ex",
             "title": "Graduate Software Engineer", "location": "Sydney, Australia", "description_raw": "Python, C++."},
            {"source": "Greenhouse", "source_url": "https://job-boards.greenhouse.io/ex/jobs/2", "company": "Ex",
             "title": "Senior Software Engineer", "location": "Sydney", "description_raw": "x"},
            {"source": "Greenhouse", "source_url": "https://job-boards.greenhouse.io/ex/jobs/3", "company": "Ex",
             "title": "Graduate Software Engineer", "location": "London", "description_raw": "x"},
            {"source": "Greenhouse", "source_url": "https://job-boards.greenhouse.io/ex/jobs/4", "company": "Ex",
             "title": "Marketing Intern", "location": "Sydney", "description_raw": "x"},
        ])


class BrokenLever:
    def fetch(self, company_token="", **kw):
        raise OSError("404 board not found")


def test_board_watchlist_and_filtered_sync(client, engine):
    from db import use_repository
    from services import boards
    assert client.post("/api/boards", json={"adapter": "greenhouse", "token": "bad token!"}).status_code == 422
    assert client.post("/api/boards", json={"adapter": "workday", "token": "x"}).status_code == 422
    listing = client.post("/api/boards", json={"boards": [
        {"adapter": "greenhouse", "token": "example", "label": "Example Robotics"},
        {"adapter": "lever", "token": "gone"}]}).json()
    assert [b["label"] for b in listing["boards"]] == ["Example Robotics", "Gone"]
    assert len(listing["suggested"]) == len(boards.SUGGESTED)
    with engine.begin() as c, use_repository(c, OWNER_A):
        assert boards.is_stale()
        result = boards.sync({"greenhouse": FakeGreenhouse, "lever": BrokenLever})
        assert result["created"] == 1
        assert "Error" in result["boards"][1]["result"]
        assert not boards.is_stale()
        assert boards.sync({"greenhouse": FakeGreenhouse, "lever": BrokenLever})["created"] == 0
    jobs = [j for j in client.get("/api/jobs").json() if j["company"] == "Example Robotics"]
    assert len(jobs) == 1 and jobs[0]["source"] == "Greenhouse board" and jobs[0]["career_fit"] is not None
    assert client.post("/api/boards/sync", json={"stale_only": True}).json()["skipped"] is True
    board_id = listing["boards"][1]["id"]
    assert len(client.post(f"/api/boards/{board_id}/delete").json()["boards"]) == 1
    client.headers["Authorization"] = "Bearer bob"
    assert client.get("/api/boards").json()["boards"] == []
    assert client.post(f"/api/boards/{board_id}/delete").status_code == 404
