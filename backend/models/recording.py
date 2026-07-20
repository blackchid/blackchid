from sqlalchemy import Float, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, new_uuid


class Recording(Base, TimestampMixin):
    """
    An audio/video file uploaded to a project.

    status lifecycle: pending → processing → done | error
    storage_path: local filesystem path or object-storage key (e.g. S3).
    """

    __tablename__ = "recordings"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Tracks where the file is in the transcription pipeline
    # Allowed values: pending | processing | done | error
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    
    # Consent fields
    consent_recording: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_external_sharing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_ai_processing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="recordings")
    segments: Mapped[list["TranscriptSegment"]] = relationship(
        "TranscriptSegment", back_populates="recording", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Recording id={self.id!r} filename={self.filename!r} status={self.status!r}>"
