"""Add application packages (tailored resume, cover letter, answers, outreach)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "0002_application_packages"
down_revision = "0001_owned_workspace"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    schema = None if bind.dialect.name == "sqlite" else "jobplicator"
    jobs = "jobs" if schema is None else "jobplicator.jobs"
    op.create_table(
        "application_packages",
        sa.Column("owner_id", sa.String(36), nullable=False),
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.Text, nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("source", sa.Text, nullable=False),
        sa.Column("content", sa.JSON, nullable=False),
        sa.Column("checks", sa.JSON, nullable=False),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
        sa.UniqueConstraint("owner_id", "id", name="uq_application_packages_owner_key"),
        sa.UniqueConstraint("owner_id", "job_id", "version", name="uq_application_package_version"),
        sa.ForeignKeyConstraint(
            ["owner_id", "job_id"],
            [f"{jobs}.owner_id", f"{jobs}.id"],
            ondelete="CASCADE",
            name="fk_application_packages_owned_parent",
        ),
        schema=schema,
    )
    op.create_index(
        "ix_application_packages_owner_id", "application_packages", ["owner_id"], schema=schema
    )
    op.create_index(
        "ix_application_packages_parent", "application_packages", ["owner_id", "job_id"], schema=schema
    )
    if bind.dialect.name == "postgresql":
        op.execute("REVOKE ALL ON jobplicator.application_packages FROM PUBLIC")
        for role in ("anon", "authenticated"):
            if bind.execute(text("SELECT 1 FROM pg_roles WHERE rolname=:r"), {"r": role}).scalar():
                op.execute(f"REVOKE ALL ON jobplicator.application_packages FROM {role}")


def downgrade():
    raise RuntimeError(
        "Destructive downgrades are disabled. Restore an explicit database backup instead."
    )
