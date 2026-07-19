from sqlalchemy import Float, ForeignKey, Integer, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, new_uuid


class PIIDetection(Base):
    """
    A detected PII entity within a specific transcript segment.
    """

    __tablename__ = "pii_detections"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    segment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("transcript_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    start_char: Mapped[int] = mapped_column(Integer, nullable=False)
    end_char: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[float] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    segment: Mapped["TranscriptSegment"] = relationship("TranscriptSegment")

    def __repr__(self) -> str:
        return (
            f"<PIIDetection id={self.id!r} "
            f"type={self.entity_type!r} "
            f"chars=[{self.start_char}:{self.end_char}] "
            f"conf={self.confidence:.2f}>"
        )
