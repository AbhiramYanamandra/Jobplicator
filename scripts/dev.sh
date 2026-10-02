#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
command -v npm >/dev/null || { echo "Install Node.js 24 LTS, then try again."; exit 1; }
if [ ! -f .env ]; then cp .env.example .env; fi
if [ ! -d app/.venv ]; then "${PYTHON:-python3}" -m venv app/.venv; fi
app/.venv/bin/python -m pip install -q -r app/requirements.txt
if [ ! -d frontend/node_modules ]; then npm --prefix frontend ci; fi
npm --prefix frontend run build
app/.venv/bin/python -m alembic upgrade head
exec app/.venv/bin/python -m uvicorn app:create_app --factory --app-dir app --host 127.0.0.1 --port 8787
