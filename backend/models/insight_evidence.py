import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, ForeignKey, UniqueConstraint, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID

from models.base import Base


class InsightEvidence(Base):
    __tablename__ = "insight_evidence"

    id = Column(
        UUID(as_uuid=False),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    insight_id = Column(
        UUID(as_uuid=False),
        ForeignKey("insights.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_id = Column(
        UUID(as_uuid=False),
        ForeignKey("transcript_segments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    clip_id = Column(
        UUID(as_uuid=False),
        ForeignKey("clipped_evidence.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    note = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("insight_id", "segment_id", name="uq_insight_segment"),
        UniqueConstraint("insight_id", "clip_id", name="uq_insight_clip"),
        CheckConstraint(
            "(segment_id IS NOT NULL AND clip_id IS NULL) OR (segment_id IS NULL AND clip_id IS NOT NULL)",
            name="chk_insight_evidence_one_source"
        ),
    )
