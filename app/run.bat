@echo off
cd /d "%~dp0.."
if not exist .env copy .env.example .env
if not exist app\.venv py -3.13 -m venv app\.venv
app\.venv\Scripts\python -m pip install -r app\requirements.txt
if errorlevel 1 exit /b 1
call npm --prefix frontend ci
if errorlevel 1 exit /b 1
call npm --prefix frontend run build
if errorlevel 1 exit /b 1
app\.venv\Scripts\python -m alembic upgrade head
if errorlevel 1 exit /b 1
app\.venv\Scripts\python -m uvicorn app:create_app --factory --app-dir app --host 127.0.0.1 --port 8787
