from sqlalchemy import Float, ForeignKey, Integer, Text, DateTime, func, CheckConstraint
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

    # Review status — must be explicitly set before the detection can be redacted.
    # Values: 'pending' (default) | 'confirmed' | 'dismissed'
    # INVARIANT: only 'confirmed' detections may appear in a redaction job.
    review_status: Mapped[str] = mapped_column(
        Text, nullable=False, default="pending",
        comment="pending | confirmed | dismissed"
    )
    reviewed_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), nullable=True,
        comment="user_id of the editor who confirmed or dismissed this detection"
    )

    created_at: Mapped[float] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    segment: Mapped["TranscriptSegment"] = relationship("TranscriptSegment")

    # Table-level constraint — keep status values in sync with code
    __table_args__ = (
        CheckConstraint(
            "review_status IN ('pending', 'confirmed', 'dismissed')",
            name="pii_detections_review_status_check",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PIIDetection id={self.id!r} "
            f"type={self.entity_type!r} "
            f"chars=[{self.start_char}:{self.end_char}] "
            f"conf={self.confidence:.2f}>"
        )
