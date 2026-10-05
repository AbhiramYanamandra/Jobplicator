"""Add AI package request queue and company job-board watchlist."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "0003_requests_and_boards"
down_revision = "0002_application_packages"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    schema = None if bind.dialect.name == "sqlite" else "jobplicator"
    jobs = "jobs" if schema is None else "jobplicator.jobs"
    op.create_table(
        "package_requests",
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.Text, nullable=False),
        sa.Column("note", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("done_at", sa.Text),
        sa.UniqueConstraint("owner_id", "id", name="uq_package_requests_owner_key"),
        sa.ForeignKeyConstraint(
            ["owner_id", "job_id"],
            [f"{jobs}.owner_id", f"{jobs}.id"],
            ondelete="CASCADE",
            name="fk_package_requests_owned_parent",
        ),
        schema=schema,
    )
    op.create_index("ix_package_requests_owner_id", "package_requests", ["owner_id"], schema=schema)
    op.create_table(
        "board_watch",
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("adapter", sa.Text, nullable=False),
        sa.Column("token", sa.Text, nullable=False),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("last_synced_at", sa.Text),
        sa.Column("last_result", sa.Text),
        sa.UniqueConstraint("owner_id", "id", name="uq_board_watch_owner_key"),
        sa.UniqueConstraint("owner_id", "adapter", "token", name="uq_board_watch_board"),
        schema=schema,
    )
    op.create_index("ix_board_watch_owner_id", "board_watch", ["owner_id"], schema=schema)
    if bind.dialect.name == "postgresql":
        for table in ("package_requests", "board_watch"):
            op.execute(f"REVOKE ALL ON jobplicator.{table} FROM PUBLIC")
            for role in ("anon", "authenticated"):
                if bind.execute(text("SELECT 1 FROM pg_roles WHERE rolname=:r"), {"r": role}).scalar():
                    op.execute(f"REVOKE ALL ON jobplicator.{table} FROM {role}")


def downgrade():
    raise RuntimeError(
        "Destructive downgrades are disabled. Restore an explicit database backup instead."
    )
