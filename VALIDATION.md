# Validation — 4.0 source

Verified locally on macOS, Python 3.13, Node.js 24:

- **56 backend tests pass on SQLite.**
- **The same 56 tests pass on a real PostgreSQL 17 instance.**
- **32 React component/integration tests pass** in an isolated DOM environment.
- React production build succeeds, with separate app, UI and authentication bundles.
- Python dependency consistency and critical static-error checks pass.
- Private v3 data import succeeds into a separate local database: 4 jobs, 62 profile evidence records, 5 coding questions, question-company links, evidence matches, requirements and the resume draft. Original database/profile bytes match the preserved backup. All imported job dossiers and key read routes respond successfully.

Tests cover signed JWT verification/rejection, invite allow-list, missing/invalid authentication, two-account read/write isolation, composite ownership constraints, CRM/history/outcomes, documents, coding attempts, profile replacement, draft revision conflicts, body limits, transactional/idempotent import and rollback, unsafe outbound destinations, sidebar state persistence, browser draft recovery, cloud saves/conflicts and authentication gating.

The source repository check inspects Git's index for private/generated paths and common secret patterns. It is a focused guard, not a comprehensive security audit.

## Not verified in this environment

- Docker image execution: Docker's daemon was not running. GitHub Actions includes a Docker build.
- Actual desktop/mobile layout, browser E2E and print pagination: the earlier browser-preview permission was declined and a headless launch was blocked. No replacement browser route was used. Playwright tests are included for CI or a user-authorized local run.
- Real Supabase sign-in/password recovery, Render deployment, GitHub CI execution or external job-provider imports: new hosted projects and their settings are still required.
- Windows launcher: included but not executed on macOS.

A Starlette test-client deprecation warning is emitted for the pinned httpx test dependency; the assertions pass. This does not affect the application runtime.
