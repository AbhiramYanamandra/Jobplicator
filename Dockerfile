FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 APP_ENV=production AUTH_MODE=supabase
WORKDIR /srv/jobplicator
COPY app/requirements.txt app/requirements.txt
RUN pip install --no-cache-dir -r app/requirements.txt && useradd --create-home --uid 10001 jobplicator
COPY app/ app/
COPY scripts/start.sh scripts/start.sh
COPY alembic.ini ./
COPY --from=frontend /build/app/static/ app/static/
RUN chmod +x scripts/start.sh && chown -R jobplicator:jobplicator /srv/jobplicator
USER jobplicator
EXPOSE 10000
CMD ["./scripts/start.sh"]
