"""Run from the source root. Secrets are read from .env, never CLI arguments."""

import argparse, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "app"))
from db import make_engine, use_repository
from settings import Settings
from legacy_import import import_legacy

parser = argparse.ArgumentParser(
    description="Dry-run or import a legacy workspace into an empty account."
)
parser.add_argument("--sqlite", required=True)
parser.add_argument("--profile")
parser.add_argument("--draft")
parser.add_argument(
    "--owner-id", required=True, help="Your Supabase Authentication user UUID"
)
parser.add_argument(
    "--apply",
    action="store_true",
    help="Commit the verified import; otherwise only inspect it",
)
args = parser.parse_args()
settings = Settings.from_env()
engine = make_engine(settings.database_url, settings.database_sslmode)
try:
    with engine.begin() as con:
        with use_repository(con, args.owner_id):
            result = import_legacy(args.sqlite, args.profile, args.draft, args.apply)
    print(json.dumps(result, indent=2))
finally:
    engine.dispose()
