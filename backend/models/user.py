"""
models/user.py — User account for authentication.

Columns deliberately mirror what fastapi-users provides so the schema
is familiar and migration to fastapi-users (async path) would be trivial.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID

from models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=False),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    email = Column(String(320), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(200), nullable=True)

    # Lifecycle flags (mirrors fastapi-users defaults)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
