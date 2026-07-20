import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base

class ClippedEvidence(Base):
    """
    Evidence collected externally via the browser extension.
    """
    __tablename__ = "clipped_evidence"

    id = Column(UUID(as_uuid=False), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=False),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quote = Column(Text, nullable=False)
    source_url = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    screenshot_path = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    project = relationship("Project")
    user = relationship("User")
