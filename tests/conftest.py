import os, sys, pathlib, pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))
os.environ.setdefault("AUTH_MODE", "local")
os.environ.setdefault("APP_ENV", "development")
from sqlalchemy import text
from alembic.config import Config
from alembic import command
from db import make_engine, use_repository, LOCAL_OWNER
from settings import Settings
from auth import User
from app import create_app
from demo import seed_demo
from fastapi.testclient import TestClient

OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"


class FakeVerifier:
    def verify(self, token):
        import jwt

        if token == "alice":
            return User(OWNER_A, "alice@example.test")
        if token == "bob":
            return User(OWNER_B, "bob@example.test")
        raise jwt.InvalidTokenError("bad token")


@pytest.fixture
def engine(tmp_path, monkeypatch):
    url = os.getenv("TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/test.db"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("AUTH_MODE", "local")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DATABASE_SSLMODE", "disable")
    e = make_engine(url, "disable")
    if e.dialect.name == "postgresql":
        # Only an explicit TEST_DATABASE_URL is ever reset by these tests.
        with e.begin() as c:
            c.execute(text("DROP SCHEMA IF EXISTS jobplicator CASCADE"))
    command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
    yield e
    e.dispose()


@pytest.fixture
def settings(engine):
    return Settings(
        "development",
        str(engine.url),
        "supabase",
        "https://example.supabase.co",
        "public-test-key",
        frozenset({OWNER_A, OWNER_B}),
        "https://jobplicator.example",
        False,
        "disable",
    )


@pytest.fixture
def client(engine, settings):
    with engine.begin() as c:
        with use_repository(c, OWNER_A):
            seed_demo()
    with TestClient(create_app(settings, engine, FakeVerifier())) as c:
        c.headers["Authorization"] = "Bearer alice"
        yield c
