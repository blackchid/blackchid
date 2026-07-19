from sqlalchemy import DateTime, Float, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pgvector.sqlalchemy import Vector

from .base import Base, new_uuid


class TranscriptSegment(Base):
    """
    One WhisperX output segment: a time-stamped, speaker-attributed piece of text.

    embedding: a 1536-dimension vector (OpenAI text-embedding-3-small or similar).
               NULL until the background embedding job runs.
               Stored in pgvector for semantic search.
    """

    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    recording_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)

    # SPEAKER_00, SPEAKER_01, … as assigned by Pyannote diarization
    speaker_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # pgvector column — 1536 dims (matches OpenAI text-embedding-3-small)
    # NULL until an embedding job processes this segment
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536), nullable=True
    )

    # WhisperX word-level timestamps — list of {word, start, end, score} dicts.
    # NULL for segments produced before this column was added or if the
    # alignment model was unavailable for the recording's language.
    word_timestamps: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[float] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    recording: Mapped["Recording"] = relationship(
        "Recording", back_populates="segments"
    )
    tag_applications: Mapped[list["TagApplication"]] = relationship(
        "TagApplication", back_populates="segment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<TranscriptSegment id={self.id!r} "
            f"[{self.start_time:.2f}→{self.end_time:.2f}] "
            f"speaker={self.speaker_label!r}>"
        )
