"""Rebuild browser test fixtures from fictional data only."""

import json, os, pathlib, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))
from alembic.config import Config
from alembic import command
from fastapi.testclient import TestClient
from db import make_engine, use_repository, LOCAL_OWNER
from settings import Settings
from app import create_app
from demo import seed_demo

with tempfile.TemporaryDirectory(prefix="jobplicator-fixtures-") as temp:
    os.environ.update(
        APP_ENV="development",
        AUTH_MODE="local",
        SUPABASE_URL="",
        SUPABASE_PUBLISHABLE_KEY="",
        ALLOWED_USER_IDS="",
        PUBLIC_URL="http://127.0.0.1:8787",
        DATABASE_URL=f"sqlite:///{temp}/fixture.db",
    )
    command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
    settings = Settings.from_env()
    engine = make_engine(settings.database_url)
    with engine.begin() as c:
        with use_repository(c, LOCAL_OWNER):
            seed_demo()
    with TestClient(create_app(settings, engine)) as c:
        paths = [
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
            "/api/me",
            "/api/config",
        ]
        fixtures = {p: c.get(p).json() for p in paths}
        for job in fixtures["/api/jobs"]:
            for p in [
                f"/api/jobs/{job['id']}",
                f"/api/jobs/{job['id']}/documents",
                f"/api/v3/jobs/{job['id']}/interview-prep",
            ]:
                fixtures[p] = c.get(p).json()
    (ROOT / "frontend/src/test-fixtures.json").write_text(
        json.dumps(fixtures, indent=2) + "\n"
    )
    engine.dispose()
print("Generated fictional API fixtures.")
