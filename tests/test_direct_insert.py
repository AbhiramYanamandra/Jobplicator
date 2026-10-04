"""Jobs inserted straight into the database by the scheduled Claude sync."""
from conftest import OWNER_A


def test_direct_db_insert_is_scored_on_list(client, engine):
    from sqlalchemy import insert
    from models import TABLES
    with engine.begin() as c:
        c.execute(insert(TABLES["jobs"]).values(
            owner_id=OWNER_A, id="JOB-DIRECT1", source="Indeed", company="Direct Co",
            title="Graduate Firmware Engineer", location="Sydney NSW",
            description_raw="Required C and STM32. Graduate role.",
            created_at="2026-10-02T00:00:00+00:00", updated_at="2026-10-02T00:00:00+00:00"))
    job = [j for j in client.get("/api/jobs").json() if j["id"] == "JOB-DIRECT1"][0]
    assert job["priority_score"] is not None


def test_detail_page_for_unscored_direct_insert(client, engine):
    """Jobs written straight to the DB (scheduled sync) have NULL role_family
    and no match rows; opening them must not 500."""
    from sqlalchemy import insert
    from models import TABLES
    with engine.begin() as c:
        c.execute(insert(TABLES["jobs"]).values(
            owner_id=OWNER_A, id="JOB-DIRECT2", source="Indeed", company="TikTok",
            title="Backend Software Engineer Graduate", location="Sydney NSW",
            description_raw="Proficient in Go, Python, Java or C++. MySQL, Redis, Kafka.",
            created_at="2026-10-04T00:00:00+00:00", updated_at="2026-10-04T00:00:00+00:00"))
    r = client.get("/api/jobs/JOB-DIRECT2")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["match"].get("career_fit") is not None
    assert body["job"]["role_family"]
