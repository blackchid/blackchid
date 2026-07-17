from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, new_uuid


class Project(Base, TimestampMixin):
    """
    A UX research project — the top-level container for recordings and tags.

    Example: "Checkout Flow Study Q3 2025"
    """

    __tablename__ = "projects"

    # Primary key: UUID generated in Python (not DB serial) for portability
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships — cascade so deleting a project cleans up everything below
    recordings: Mapped[list["Recording"]] = relationship(
        "Recording", back_populates="project", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id!r} name={self.name!r}>"
