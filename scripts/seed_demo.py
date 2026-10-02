import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "app"))
from settings import Settings
from db import make_engine, use_repository, LOCAL_OWNER
from demo import seed_demo

settings = Settings.from_env()
if settings.environment != "development" or settings.auth_mode != "local":
    raise SystemExit("Fictional demo seed is available only in local development mode.")
engine = make_engine(settings.database_url, settings.database_sslmode)
with engine.begin() as con:
    with use_repository(con, LOCAL_OWNER):
        seed_demo()
print("Fictional demo workspace created.")
