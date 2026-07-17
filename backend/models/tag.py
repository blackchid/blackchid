from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, new_uuid


class Tag(Base, TimestampMixin):
    """
    A reusable insight label scoped to a project.

    Examples: "pain point", "delight moment", "usability issue", "feature request"
    color: hex string (e.g. "#ef4444") used by the frontend to render tag chips.
    """

    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tags")
    applications: Mapped[list["TagApplication"]] = relationship(
        "TagApplication", back_populates="tag", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tag id={self.id!r} name={self.name!r} project={self.project_id!r}>"
