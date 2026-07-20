from sqlalchemy import Column, String, ForeignKey, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .base import Base, new_uuid

class AITagSuggestion(Base):
    """
    An AI-generated tag suggestion awaiting human review.
    """
    __tablename__ = "ai_tag_suggestions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("transcript_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    suggested_name: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Status: 'pending', 'accepted', 'rejected'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project")
    segment = relationship("TranscriptSegment")

    def __repr__(self) -> str:
        return f"<AITagSuggestion id={self.id!r} name={self.suggested_name!r} status={self.status!r}>"
