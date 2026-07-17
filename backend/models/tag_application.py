from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, new_uuid


class TagApplication(Base, TimestampMixin):
    """
    A tag applied to a specific transcript segment by a researcher.

    note: optional free-text annotation explaining why this tag was applied.

    The UNIQUE constraint on (tag_id, segment_id) prevents applying the same
    tag twice to the same segment.
    """

    __tablename__ = "tag_applications"

    __table_args__ = (
        UniqueConstraint("tag_id", "segment_id", name="uq_tag_application"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    tag_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("transcript_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    tag: Mapped["Tag"] = relationship("Tag", back_populates="applications")
    segment: Mapped["TranscriptSegment"] = relationship(
        "TranscriptSegment", back_populates="tag_applications"
    )

    def __repr__(self) -> str:
        return (
            f"<TagApplication tag={self.tag_id!r} segment={self.segment_id!r}>"
        )
