# v2/v3 feature preservation

| Original capability | React workspace | Storage/behavior in 4.0 |
| --- | --- | --- |
| Job ingestion and manual jobs | Jobs / Import jobs | Account-owned jobs, Greenhouse/Lever, optional public URL import |
| Dossier and evidence matching | Job dossier / Evidence | Original heuristics using each account's profile |
| Cluster map and summaries | Clusters | Same clustering signals, interactive SVG |
| Application CRM and history | Applications / dossier | PostgreSQL applications/events/outcomes |
| Funnel, roles and sources | Analytics | Same observed conversion semantics |
| Skills and gaps | Skills | Account-specific evidence and job demand |
| Strategy and weekly reports | Strategy | Saved reports; transparent weight proposal history |
| Coding/LeetCode questions | Question Bank | Difficulty/topic/company/role/stage and provenance tags |
| Attempts, readiness and heatmap | Question Bank | Persistent attempt history and company × topic aggregation |
| Interview questions and STAR | Interview Prep | Account-owned questions and profile stories |
| Resume editor and evidence bullets | Resume Studio | Cloud draft with revision checks; named application versions |
| Resume output | Resume Studio | JSON, print/PDF, Word-compatible HTML `.doc` |
| Career source data | Profile & Data | Private database JSON; explicit import/export |

All active pages are React/Chakra. Original route paths remain; they now require authentication in hosted mode and validate write payloads. Domain reads/writes use SQLAlchemy with account ownership. The earlier SQLite file and embedded personal data are no longer deployed. Preserved limitations are listed in the root README.
