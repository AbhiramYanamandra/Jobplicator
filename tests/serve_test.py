"""Serve fictional, disposable data for browser tests. Never reads private files."""

import os
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))


def main():
    import uvicorn

    with tempfile.TemporaryDirectory(prefix="jobplicator-browser-test-") as folder:
        os.environ.update(
            APP_ENV="development",
            AUTH_MODE="local",
            DATABASE_URL=f"sqlite:///{folder}/test.db",
            PUBLIC_URL="http://127.0.0.1:8790",
            SUPABASE_PUBLISHABLE_KEY="",
            ALLOWED_USER_IDS="",
        )
        from alembic import command
        from alembic.config import Config
        from settings import Settings
        from db import make_engine, use_repository, LOCAL_OWNER
        from demo import seed_demo
        from app import create_app

        command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
        settings = Settings.from_env()
        engine = make_engine(settings.database_url)
        with engine.begin() as con:
            with use_repository(con, LOCAL_OWNER):
                seed_demo()
        try:
            uvicorn.run(create_app(settings, engine), host="127.0.0.1", port=8790)
        finally:
            engine.dispose()


if __name__ == "__main__":
    main()
