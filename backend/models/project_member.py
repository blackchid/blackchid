import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID

from models.base import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(50), nullable=False)  # "editor" or "viewer"

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_user"),
    )
