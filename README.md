# Jobplicator 4.0

A private job-search workspace built with **React 19, Chakra UI 3, FastAPI, and PostgreSQL**. Supabase provides the hosted database and sign-in; Render builds and serves the application. This repository is the source of truth. There is no separate runnable edition to maintain.

## Run locally

Install **Python 3.13** and **Node.js 24 LTS**. From the repository root:

```bash
./app/run.sh
```

Open **http://127.0.0.1:8787**. The launcher creates an isolated Python environment, installs dependencies, builds React, migrates the local database, and starts FastAPI. First launch needs internet access. Stop with Ctrl+C. On Windows, use `app\run.bat`.

A fresh clone starts empty. To try fictional examples after the first setup:

```bash
app/.venv/bin/python scripts/seed_demo.py
```

The demo command refuses a populated jobs workspace. Do not seed an account intended for a legacy import.

**`npm run dev` versus `./app/run.sh`:** the launcher builds React and serves the entire app at port 8787. For editing React with automatic reload, leave the backend running and open a second terminal:

```bash
cd frontend
npm run dev
```

Open the Vite address shown in the terminal, using `/static/`. Vite forwards API requests to FastAPI on port 8787. Run `npm ci` after pulling dependency changes. Changes are deployed by building from the same source.

## Put it online

Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** to create the three new projects in order:

1. Push this source folder to GitHub.
2. Create Supabase, your sign-in account, and database connection.
3. Connect the GitHub repository to Render using `render.yaml` and enter the environment settings.

No credentials, paid services, or hosted projects are supplied by this repository. A checked-in Dockerfile builds React and serves it through FastAPI on one HTTPS origin. The private database lives in Supabase and survives Render restarts. No persistent disk is required on Render.

## Your private data

`.env`, `.private/`, databases, career evidence files under `app/data`, browser recovery data, dependencies, and generated assets are excluded from Git. The Docker build also uses a source allow-list. New source includes only fictional examples and test fixtures.

**Do not copy an old database over the new database.** The schema now includes account ownership. Use the read-only, transactional migration tool described in [DEPLOYMENT.md](DEPLOYMENT.md#move-your-existing-v3-data). It preserves natural record IDs and remaps integer IDs while verifying relationships. Dry-run is the default; applying the same import twice is harmless. Import into an empty account.

Use **Profile & Data** to edit identity and import/export evidence JSON. Resume Studio saves its cloud draft explicitly and detects conflicting edits from another device. Recovery drafts remain in account-specific browser storage; they do not sync until saved. Saved application versions and cover letters are database-backed. Old unscoped browser drafts are not automatically loaded into a signed-in account; export them from the old app and restore the JSON in Resume Studio.

## Workspace features

- Dashboard, job search/filtering, manual entry, dossiers, evidence matching and cover-letter versions.
- Interactive cluster map, cluster summaries, application CRM, event history, follow-ups and outcomes.
- Analytics, application funnel, source/role performance, skill demand and gaps, strategy recommendations and weekly reports.
- Interview preparation, STAR evidence, question bank, LeetCode tags, companies/roles/stages, attempt tracking, readiness and company × topic heatmap.
- Resume editor with evidence-based bullet variants, A4 preview, sections, ordering, JSON backups, saved versions, print/PDF and Word-compatible HTML export.
- Collapsible desktop sidebar, mobile navigation, responsive layouts, Chakra theme, light/dark mode, accessible controls and useful empty/error states.

The original heuristics remain transparent: historical conversion is an observation rather than a hiring probability; company-tagged prep is distinct from confirmed interviews; scoring-weight history records proposals rather than changing the fit engine. Editing a resume does not recalculate fit. The `.doc` export is HTML readable by Word, not native DOCX. Print pagination needs checking in the browser. SEEK/LinkedIn ingestion still requires authorized provider access. Indeed results can be imported from the existing Claude connector workflow. Generic URL import is opt-in; board imports use bounded, public-network-only requests.

### Indeed connector bridge

The existing Claude scheduled task can search Indeed using its connected Indeed tool and send results to this site. This is an import bridge, not a website-side Indeed scraper or a server-side Indeed API client.

Set `INDEED_IMPORT_OWNER_ID` on Render to the Supabase Auth user UUID that owns the workspace. Set `INDEED_IMPORT_TOKEN` to a randomly generated secret of at least 32 characters. On the machine running the Claude task, save the same token to `~/.config/jobplicator/indeed-import-token` with owner-only file permissions. Never commit the token or paste it into a task prompt.

After Claude obtains full job details, save a UTF-8 JSON object with a `jobs` array. Each item must contain `source_url` (an Indeed HTTPS link), `company`, `title`, and `description_raw`; `location`, `work_mode`, and `posted_at` are optional. Run `python scripts/send_indeed_jobs.py /path/to/jobs.json` from this repository. The script sends the data over HTTPS; the backend validates it, stores it only in the configured account, scores new jobs, and skips URLs already imported. Each request accepts up to 100 jobs and 1 MB.

## Development and verification

```bash
app/.venv/bin/python -m pip install -r tests/requirements.txt
app/.venv/bin/python -m pytest -c pytest.ini tests -q
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run build
```

For PostgreSQL tests, set `TEST_DATABASE_URL` to a **disposable test database**, then run pytest. The tests delete its `jobplicator` schema. Never point this variable at a live database.

Optional real-browser checks after building:

```bash
cd frontend
npx playwright install chromium
npm run test:browser
```

The browser server generates fictional data in a temporary database. GitHub Actions runs SQLite/PostgreSQL tests, component tests, browser tests and a Docker build. Local verification results and limits are recorded in [VALIDATION.md](VALIDATION.md); configured CI checks are not a claim that a hosted CI run has happened.

## Layout

| Path | Purpose |
| --- | --- |
| `frontend/src/` | React pages, Chakra theme, authentication and tests |
| `app/app.py` | FastAPI factory and protected API routes |
| `app/db.py`, `app/models.py` | Account-scoped SQLAlchemy repository and schema |
| `app/migrations/` | Versioned Alembic migrations |
| `app/services/` | Career matching, v3 analytics and strategy |
| `app/adapters/` | Job ingestion and outbound request controls |
| `scripts/` | Launch, migration, demo and repository checks |
| `examples/` | Fictional profile template |
| `Dockerfile`, `render.yaml` | Hosted build and deployment configuration |

Python runtime versions are pinned in `app/requirements.txt`; JavaScript resolution is locked in `frontend/package-lock.json`. [Architecture](app/ARCHITECTURE.md) explains authentication, ownership and migration choices.
