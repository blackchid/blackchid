"""
models/base.py — Shared declarative Base and reusable mixins.

All ORM models import Base from here so Alembic's autogenerate
can discover them through a single metadata object.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Project-wide SQLAlchemy declarative base."""
    pass


class TimestampMixin:
    """
    Adds created_at and updated_at columns to any model.

    - created_at: set once at INSERT time by the DB server (server_default)
    - updated_at: refreshed on every UPDATE via onupdate trigger
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def new_uuid() -> str:
    """Default factory for UUID primary keys."""
    return str(uuid.uuid4())
