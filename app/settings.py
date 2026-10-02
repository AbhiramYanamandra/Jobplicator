"""Environment configuration. Production refuses insecure/local defaults."""

from dataclasses import dataclass
from pathlib import Path
import os
from urllib.parse import urlparse
from uuid import UUID
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / ".env")


@dataclass(frozen=True)
class Settings:
    environment: str
    database_url: str
    auth_mode: str
    supabase_url: str
    supabase_publishable_key: str
    allowed_user_ids: frozenset[str]
    public_url: str
    enable_generic_import: bool
    database_sslmode: str

    @classmethod
    def from_env(cls):
        environment = os.getenv("APP_ENV", "development")
        database_url = os.getenv(
            "DATABASE_URL", f"sqlite:///{ROOT / 'data/cloud-dev.db'}"
        )
        if (
            database_url.startswith("sqlite:///")
            and not database_url.startswith("sqlite:////")
            and not database_url.endswith(":memory:")
        ):
            database_url = "sqlite:///" + str(
                (ROOT.parent / database_url.split("///", 1)[1]).resolve()
            )
        if database_url.startswith(("postgres://", "postgresql://")):
            database_url = "postgresql+psycopg://" + database_url.split("://", 1)[1]
        config = cls(
            environment,
            database_url,
            os.getenv("AUTH_MODE", "supabase"),
            os.getenv("SUPABASE_URL", "").rstrip("/"),
            os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
            frozenset(
                x.strip()
                for x in os.getenv("ALLOWED_USER_IDS", "").split(",")
                if x.strip()
            ),
            os.getenv("PUBLIC_URL", "http://127.0.0.1:8787").rstrip("/"),
            os.getenv("ENABLE_GENERIC_URL_IMPORT", "false").lower() == "true",
            os.getenv(
                "DATABASE_SSLMODE",
                "require" if environment == "production" else "prefer",
            ),
        )
        if environment not in ("development", "production"):
            raise ValueError("APP_ENV must be development or production")
        for owner in config.allowed_user_ids:
            if str(UUID(owner)) != owner:
                raise ValueError("ALLOWED_USER_IDS must contain canonical UUIDs")
        if (
            config.supabase_publishable_key
            and not config.supabase_publishable_key.startswith("sb_publishable_")
        ):
            raise ValueError(
                "Use the Supabase publishable key (sb_publishable_), never a secret or service-role key"
            )
        if config.auth_mode not in ("supabase", "local"):
            raise ValueError("AUTH_MODE must be supabase or local")
        if config.auth_mode == "supabase" and (
            not config.supabase_url.startswith("https://")
            or not config.supabase_publishable_key
        ):
            raise ValueError(
                "Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or explicitly choose AUTH_MODE=local for local development."
            )
        if environment == "production":
            if config.auth_mode != "supabase" or not database_url.startswith(
                "postgresql+psycopg://"
            ):
                raise ValueError(
                    "Production requires PostgreSQL and Supabase authentication."
                )
            if not config.allowed_user_ids:
                raise ValueError(
                    "Production requires ALLOWED_USER_IDS. Add your Supabase Auth user UUID."
                )
            if not config.public_url.startswith("https://"):
                raise ValueError("Production requires an HTTPS PUBLIC_URL.")
            if config.database_sslmode not in ("require", "verify-ca", "verify-full"):
                raise ValueError("Production requires TLS for database connections.")
        if config.auth_mode == "local" and urlparse(config.public_url).hostname not in (
            "localhost",
            "127.0.0.1",
            "::1",
        ):
            raise ValueError("Local auth mode requires a loopback PUBLIC_URL.")
        return config
