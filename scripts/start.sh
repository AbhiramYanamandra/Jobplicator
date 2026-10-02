#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
# Migrations are idempotent and serialized with a PostgreSQL advisory lock.
python -m alembic upgrade head
exec python -m uvicorn app:create_app --factory --app-dir app --host 0.0.0.0 --port "${PORT:-10000}" --no-access-log
