"""One-time, transactional import from a read-only v3 SQLite database.

Integer identities are remapped and verified, retaining all foreign-key links.
Natural job/evidence IDs are preserved within the new account's namespace.
"""

import hashlib, json, sqlite3
from pathlib import Path
from db import repo, now
from models import metadata, LEGACY_COLUMNS, REFERENCES
from profile_store import save_profile

ORDER = [t.name for t in metadata.sorted_tables if t.name in LEGACY_COLUMNS]


def read_legacy(path):
    path = Path(path).resolve()
    with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as con:
        con.row_factory = sqlite3.Row
        if con.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Legacy database integrity check failed")
        if con.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("Legacy database contains invalid foreign keys")
        available = {
            x[0]
            for x in con.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        return {
            name: [dict(r) for r in con.execute(f'SELECT * FROM "{name}"')]
            if name in available
            else []
            for name in ORDER
        }


def import_legacy(path, profile_path=None, draft_path=None, apply=False):
    source = read_legacy(path)
    profile = json.loads(Path(profile_path).read_text()) if profile_path else None
    draft = json.loads(Path(draft_path).read_text()) if draft_path else None
    canonical = json.dumps(
        {"tables": source, "profile": profile, "draft": draft}, sort_keys=True
    )
    fingerprint = hashlib.sha256(canonical.encode()).hexdigest()
    counts = {name: len(rows) for name, rows in source.items()}
    r = repo()
    r.lock_account()
    if r.one("legacy_imports", fingerprint=fingerprint):
        return {"already_imported": True, "counts": counts, "fingerprint": fingerprint}
    if not apply:
        return {
            "dry_run": True,
            "counts": counts,
            "evidence_records": len((profile or {}).get("evidence", [])),
            "has_resume_draft": draft is not None,
            "fingerprint": fingerprint,
        }
    if any(r.all(name, limit=1) for name in ORDER):
        raise ValueError(
            "Import requires an empty account workspace. Use a fresh account or restore a backup; existing records are never overwritten."
        )
    if draft:
        from app import validate_draft

        validate_draft(draft)
    maps = {}
    for name in ORDER:
        pk = next(c["name"] for c in LEGACY_COLUMNS[name] if c["pk"])
        integer = next(c["type"] for c in LEGACY_COLUMNS[name] if c["pk"]) == "INTEGER"
        columns = {c["name"] for c in LEGACY_COLUMNS[name]}
        maps[name] = {}
        for old in source[name]:
            values = {k: v for k, v in old.items() if k in columns}
            original_key = old[pk]
            if integer:
                values.pop(pk, None)
            if name in REFERENCES:
                key, parent, target = REFERENCES[name]
                original_parent = old.get(key)
                if original_parent is not None:
                    if original_parent not in maps[parent]:
                        raise ValueError(
                            f"{name} has an orphaned {key}; import rolled back"
                        )
                    values[key] = maps[parent][original_parent]
            new_id = r.insert(name, values)
            maps[name][original_key] = new_id if integer else values[pk]
        stored = r.all(name)
        if len(stored) != counts[name]:
            raise ValueError(f"{name}: imported count mismatch")
        if name in REFERENCES:
            key, parent, _ = REFERENCES[name]
            parent_ids = set(maps[parent].values())
            if any(
                row[key] is not None and row[key] not in parent_ids for row in stored
            ):
                raise ValueError(f"{name}: imported relationship mismatch")
    if profile:
        save_profile(profile)
    if draft:
        r.upsert(
            "resume_drafts",
            {"content": draft, "revision": 1, "updated_at": now()},
            keys=[],
        )
    r.insert(
        "legacy_imports",
        {"fingerprint": fingerprint, "counts": counts, "created_at": now()},
    )
    return {"imported": True, "counts": counts, "fingerprint": fingerprint}
