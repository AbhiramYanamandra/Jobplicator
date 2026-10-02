from alembic import context
import os
from sqlalchemy import text
from db import make_engine
from models import metadata
from settings import Settings

settings = Settings.from_env()
url = os.getenv("MIGRATION_DATABASE_URL", settings.database_url)
if url.startswith(("postgres://", "postgresql://")):
    url = "postgresql+psycopg://" + url.split("://", 1)[1]
engine = make_engine(url, settings.database_sslmode)
with engine.connect() as connection:
    if engine.dialect.name == "postgresql":
        # Serialize startup migrations during overlapping rolling deploys.
        connection.execute(text("SELECT pg_advisory_lock(7365219940123)"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS jobplicator"))
        connection.commit()
    context.configure(
        connection=connection,
        target_metadata=metadata,
        include_schemas=True,
        version_table_schema=None if engine.dialect.name == "sqlite" else "jobplicator",
    )
    with context.begin_transaction():
        context.run_migrations()
    if engine.dialect.name == "postgresql":
        connection.execute(text("SELECT pg_advisory_unlock(7365219940123)"))
        connection.commit()
engine.dispose()
