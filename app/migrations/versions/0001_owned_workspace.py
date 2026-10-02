"""Create account-owned schema. Existing legacy files are imported explicitly."""

from alembic import op
from sqlalchemy import text
from migrations.schema_v1 import metadata

revision = "0001_owned_workspace"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    metadata.create_all(bind)
    if bind.dialect.name == "postgresql":
        op.execute("REVOKE ALL ON SCHEMA jobplicator FROM PUBLIC")
        op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA jobplicator FROM PUBLIC")
        for role in ("anon", "authenticated"):
            if bind.execute(
                text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role}
            ).scalar():
                op.execute(f"REVOKE ALL ON SCHEMA jobplicator FROM {role}")
                op.execute(
                    f"REVOKE ALL ON ALL TABLES IN SCHEMA jobplicator FROM {role}"
                )
        # Private schema is accessed exclusively by FastAPI, never Supabase Data API.


def downgrade():
    raise RuntimeError(
        "Destructive downgrades are disabled. Restore an explicit database backup instead."
    )
