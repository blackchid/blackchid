"""
alembic/env.py — Alembic migration environment.

Key customisations from the default generated file:
  - Reads DATABASE_URL from the environment (no hard-coded creds)
  - Imports all SQLAlchemy models via `models` package so autogenerate
    can diff the ORM against the live database
  - Enables pgvector extension creation in the migration
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, text

from alembic import context

# ── Make the backend/ package importable ─────────────────────────────────────
# Alembic runs from backend/alembic/, so we add backend/ to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Import Base (with all models registered) for autogenerate
from models import Base  # noqa: E402

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config

# Wire up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for --autogenerate comparison
target_metadata = Base.metadata


def get_url() -> str:
    """Read DATABASE_URL from environment — never hard-code credentials."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set.\n"
            "Set it before running alembic:\n"
            "  export DATABASE_URL=postgresql://user:pass@localhost:5432/dbname"
        )
    return url


def run_migrations_offline() -> None:
    """
    Offline mode: emit SQL to stdout without connecting to the DB.
    Useful for generating SQL scripts to review before applying.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Online mode: connect to the DB and apply migrations directly.
    Also ensures the pgvector extension exists before migrating.
    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Create pgvector extension if it doesn't exist yet.
        # This is idempotent — safe to run on every migration.
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
