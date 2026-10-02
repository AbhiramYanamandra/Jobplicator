"""SQLAlchemy engine and explicit, request-scoped account repository.

No SQL string rewriting and no implicit/default account. Every domain read/write
must go through a Repository constructed from the authenticated user.
"""

from contextvars import ContextVar
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID
from sqlalchemy import create_engine, select, and_, event, inspect
from sqlalchemy.pool import StaticPool
from models import TABLES, LEGACY_COLUMNS, metadata

_current = ContextVar("jobplicator_repository")
LOCAL_OWNER = "00000000-0000-4000-8000-000000000001"


def now():
    return datetime.now(timezone.utc).isoformat()


def make_engine(url, sslmode="prefer"):
    sqlite = url.startswith("sqlite")
    options = {"pool_pre_ping": True}
    if sqlite:
        options["connect_args"] = {"check_same_thread": False}
        if url.endswith(":memory:"):
            options["poolclass"] = StaticPool
        else:
            path = url.split("///", 1)[-1]
            Path(path).parent.mkdir(parents=True, exist_ok=True)
    else:
        options.update(
            pool_size=5,
            max_overflow=5,
            connect_args={"sslmode": sslmode, "connect_timeout": 10},
        )
    engine = create_engine(url, **options).execution_options(
        schema_translate_map={"jobplicator": None if sqlite else "jobplicator"}
    )
    if sqlite:

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine


class Repository:
    def __init__(self, connection, owner_id):
        self.connection = connection
        self.owner_id = str(UUID(owner_id))

    def condition(self, table, filters):
        if "owner_id" in filters:
            raise ValueError("Owner cannot be supplied in record filters")
        return and_(
            table.c.owner_id == self.owner_id,
            *(table.c[k] == v for k, v in filters.items()),
        )

    def all(self, name, /, order=None, limit=None, **filters):
        table = TABLES[name]
        stmt = select(table).where(self.condition(table, filters))
        for key in order or []:
            stmt = stmt.order_by(
                table.c[key.lstrip("-")].desc() if key.startswith("-") else table.c[key]
            )
        if limit is not None:
            stmt = stmt.limit(limit)
        return [dict(r) for r in self.connection.execute(stmt).mappings()]

    def one(self, name, /, **filters):
        results = self.all(name, limit=1, **filters)
        return results[0] if results else None

    def insert(self, name, values):
        if "owner_id" in values:
            raise ValueError("Owner cannot be supplied in record content")
        table = TABLES[name]
        values = dict(values)
        for col in LEGACY_COLUMNS.get(name, []):
            if col["name"] in values:
                continue
            default = col["default"]
            if default == "CURRENT_TIMESTAMP":
                values[col["name"]] = now()
            elif default is not None:
                if col["type"] == "INTEGER":
                    values[col["name"]] = int(default)
                elif col["type"] == "REAL":
                    values[col["name"]] = float(default)
                else:
                    values[col["name"]] = default.strip("'")
        result = self.connection.execute(
            table.insert().values(owner_id=self.owner_id, **values)
        )
        return next(
            (v for v in result.inserted_primary_key if isinstance(v, int)), None
        )

    def update(self, name, values, /, **filters):
        if "owner_id" in values:
            raise ValueError("Owner cannot be changed")
        table = TABLES[name]
        return self.connection.execute(
            table.update().where(self.condition(table, filters)).values(**values)
        ).rowcount

    def delete(self, name, /, **filters):
        table = TABLES[name]
        return self.connection.execute(
            table.delete().where(self.condition(table, filters))
        ).rowcount

    def upsert(self, name, values, keys):
        table = TABLES[name]
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        factory = (
            sqlite_insert if self.connection.dialect.name == "sqlite" else pg_insert
        )
        if "owner_id" in values:
            raise ValueError("Owner cannot be supplied")
        stmt = factory(table).values(owner_id=self.owner_id, **values)
        updates = {k: getattr(stmt.excluded, k) for k in values if k not in keys}
        self.connection.execute(
            stmt.on_conflict_do_update(index_elements=["owner_id", *keys], set_=updates)
        )

    def lock_account(self):
        # Stable advisory lock serializes version allocation, draft CAS, imports,
        # and application updates for one account, without blocking other users.
        if self.connection.dialect.name == "postgresql":
            import hashlib
            from sqlalchemy import text

            key = int.from_bytes(
                hashlib.sha256(self.owner_id.encode()).digest()[:8], "big", signed=True
            )
            self.connection.execute(
                text("SELECT pg_advisory_xact_lock(:key)"), {"key": key}
            )

    def jobs(self):
        j, m, a = (TABLES[n] for n in ("jobs", "job_matches", "applications"))
        stmt = (
            select(
                j,
                m.c.career_fit,
                m.c.resume_fit,
                m.c.potential_fit,
                m.c.priority_score,
                a.c.status.label("application_status"),
                a.c.next_action,
                a.c.follow_up_date,
            )
            .select_from(
                j.outerjoin(
                    m, and_(j.c.id == m.c.job_id, j.c.owner_id == m.c.owner_id)
                ).outerjoin(a, and_(j.c.id == a.c.job_id, j.c.owner_id == a.c.owner_id))
            )
            .where(j.c.owner_id == self.owner_id)
            .order_by(m.c.priority_score.desc().nullslast(), j.c.created_at.desc())
        )
        return [dict(r) for r in self.connection.execute(stmt).mappings()]

    def applications(self):
        a, j, m = (TABLES[n] for n in ("applications", "jobs", "job_matches"))
        stmt = (
            select(
                a,
                j.c.title,
                j.c.company,
                j.c.location,
                j.c.closing_date,
                j.c.role_family,
                j.c.source,
                m.c.career_fit,
                m.c.resume_fit,
            )
            .select_from(
                a.join(
                    j, and_(j.c.id == a.c.job_id, j.c.owner_id == a.c.owner_id)
                ).outerjoin(m, and_(m.c.job_id == j.c.id, m.c.owner_id == j.c.owner_id))
            )
            .where(a.c.owner_id == self.owner_id)
            .order_by(a.c.updated_at.desc())
        )
        return [dict(r) for r in self.connection.execute(stmt).mappings()]


@contextmanager
def use_repository(connection, owner_id):
    repository = Repository(connection, owner_id)
    token = _current.set(repository)
    try:
        yield repository
    finally:
        _current.reset(token)


def repo():
    try:
        return _current.get()
    except LookupError:
        raise RuntimeError(
            "Database access requires an authenticated account context"
        ) from None


def all_rows(name, /, **filters):
    return repo().all(name, **filters)


def one_row(name, /, **filters):
    return repo().one(name, **filters)


def list_jobs():
    return repo().jobs()


def list_applications():
    return repo().applications()
