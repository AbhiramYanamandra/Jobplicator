# Deploy Jobplicator from a new GitHub repository

You need GitHub, Supabase and Render accounts. Keep database passwords in your password manager, your ignored `.env`, or Render's environment settings. Never place them in source, screenshots, GitHub issues or chat.

## 1. Publish the source to GitHub

Create an empty repository named `jobplicator` in GitHub. Private is a reasonable starting choice. Do not add a README to the empty remote. Open a terminal in **this folder**, which contains `frontend/`, `app/`, and `render.yaml`:

```bash
git init -b main
git add .
python3 scripts/check_public_repo.py
git status --short
git commit -m "Prepare Jobplicator for deployment"
git remote add origin https://github.com/YOUR-USERNAME/jobplicator.git
git push -u origin main
```

If Git is already initialized, skip `git init`. If Git asks for an identity, configure your own name/email. Authenticate using GitHub's normal browser/token flow. Do not paste a token into the remote URL.

Review what is staged. `.env`, `.private`, databases, `app/data` content, compiled assets and dependencies must be absent. Only `.env.example` and `app/data/.gitkeep` are intended exceptions. This source contains fictional test/demo data. Do not push an older runnable archive or its embedded personal database.

## 2. Create Supabase and your account

1. Create a Supabase project. Choose a database password and store it safely.
2. Open the project's connection dialog and select **Session pooler**, port **5432**. Copy its PostgreSQL URI and replace the password placeholder. URL-encode any special characters in the password. Session pooling supports IPv4 and persistent backends; see [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. Copy the **Project URL** and **publishable API key** (`sb_publishable_...`). The publishable key is safe for the browser. This app does not need a secret/service-role key. See [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).
4. In Authentication settings, use an active **asymmetric signing key** (ES256 or RS256). New-project defaults may already provide it. This server verifies signatures via the project's JWKS endpoint; legacy HS256 tokens are deliberately unsupported. See [signing keys](https://supabase.com/docs/guides/auth/signing-keys).
5. In Authentication → Users, add your email/password account through the admin dashboard and confirm it there. Copy its **user UUID**. Disable public sign-ups for this personal workspace. The UI has sign-in and password recovery, not public registration.
6. Keep the `jobplicator` database schema out of the Data API's exposed schemas. The migration creates this private schema and revokes access from browser roles. FastAPI accesses it over a server-side PostgreSQL connection.

The first deployment will create the application tables automatically. Do not run the old SQLite schema in Supabase. For initial setup, the session-pooler connection for the project's database owner can perform the migration. That credential stays on the server. A separate migration/runtime database role is an optional later hardening step; `MIGRATION_DATABASE_URL` supports a DDL-capable migration connection.

## 3. Create Render from the repository

1. In Render, create a **Blueprint**, authorize GitHub and select the repository. It reads `render.yaml`. See [Render's Blueprint reference](https://render.com/docs/blueprint-spec).
2. The blueprint selects one free Docker web service. Review the service plan and current limits before creating it. No service is created merely by having this file in GitHub.
3. Enter the requested values:

| Setting | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **session-pooler** PostgreSQL URI with your password |
| `SUPABASE_URL` | Project URL, such as `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` public key |
| `ALLOWED_USER_IDS` | Your confirmed user's UUID; comma-separated UUIDs for additional invited accounts |
| `PUBLIC_URL` | The service's final `https://...onrender.com` URL or your custom HTTPS domain |

The blueprint sets `APP_ENV=production`, `AUTH_MODE=supabase`, `DATABASE_SSLMODE=require`, and generic imports off. Render supplies the listening port. If Render has not assigned the final URL yet, use your expected service URL for creation, then update `PUBLIC_URL` to the assigned URL before using sign-in/recovery.

4. Deploy. Docker installs locked frontend dependencies, compiles React, installs pinned Python dependencies, and runs under an unprivileged user. Startup applies migrations under a database lock, then starts FastAPI. No fictional or personal data is seeded. Check the deployment log and `/api/health`; it should report `ok: true` with PostgreSQL.
5. In Supabase Authentication → URL Configuration, set **Site URL** and an allowed **Redirect URL** to the exact public app origin, for example `https://YOUR-SERVICE.onrender.com`. Update these and `PUBLIC_URL` if your domain changes. Password recovery returns to this origin. Configure email delivery in Supabase if you need reliable recovery emails.
6. Open the public URL and sign in. Add your profile/evidence, or import your old workspace as below. Reopen the page in a private browser window to confirm it asks for sign-in; sign in on another device to confirm saved data is shared.

Subsequent commits deploy after CI checks pass. GitHub Actions must be enabled; see [Render deploy behavior](https://render.com/docs/deploys). The initial deployment and Supabase sign-in must be verified against your real projects once they exist.

## Move your existing v3 data

The migration reads the old database without changing it. It must target an **empty account's workspace**. Use your latest old database, career evidence JSON, and an exported resume draft. Keep a separate backup before proceeding. Export any unsaved browser resume through the old Resume Studio first.

Store private inputs in `.private/legacy/` (ignored):

- `jobplicator.db`
- `career_evidence.json`
- `resume-draft.json`, optional; structure `{ "resume": { ... }, "contact": { "name": "...", "line": "..." } }`

In your ignored `.env`, set the same production values used in Render. Stop a running local app first so you do not accidentally edit the hosted account while testing. The command uses `DATABASE_URL` from that file; double-check the intended project. Secrets are never passed as command arguments.

```bash
app/.venv/bin/python -m alembic upgrade head
app/.venv/bin/python scripts/import_legacy.py \
  --sqlite .private/legacy/jobplicator.db \
  --profile .private/legacy/career_evidence.json \
  --draft .private/legacy/resume-draft.json \
  --owner-id YOUR-SUPABASE-USER-UUID
```

This is a dry run: it prints record counts and a fingerprint without inserting records. Omit `--draft` if you have no draft. After reviewing those counts, repeat the command with **`--apply`** to commit the import. All inserts happen in one transaction; failures roll back. Job/evidence identifiers are preserved; integer IDs are remapped and linked records are checked. A fingerprint prevents accidental duplication on a repeat run. A dry run does not guarantee an apply will succeed if legacy content fails validation.

The import covers all v3 tables, including jobs/matches/evidence links, applications/events/outcomes, saved documents, coding questions/company tags/attempts, interview questions, reminders, weights, reports and ingestion history. Career evidence and the general resume draft are imported separately into your account. Verify the displayed counts, a dossier, an application, question attempts and a resume version after importing.

For local migration instead, retain the local values in `.env.example` and use owner UUID `00000000-0000-4000-8000-000000000001`. Local development accepts only loopback requests and requires explicit `AUTH_MODE=local`. Restore local settings after working with production credentials.

## Updates and recovery

- Back up the Supabase database before future schema changes. This migration disables destructive downgrade; restore a known backup for data recovery.
- Rebuild from GitHub for code changes. Do not edit compiled files inside Render.
- Export profile and resume JSON for portable copies. These exports are **not** full application-database backups.
- Changing the allow-list requires a server restart/deploy; removing a UUID immediately blocks it on the restarted server. This is a private invited-account deployment, not a public SaaS sign-up flow.
- Database errors expose a generic message to clients. A missing migration, incorrect password, wrong pooler host, or non-asymmetric JWT setup prevents the app from starting or signing in; check settings rather than disabling authentication.
- Long-running ingestion is synchronous and bounded. Background workers, billing and team workspaces are outside this version.
