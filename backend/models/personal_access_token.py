import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from models.base import Base

class PersonalAccessToken(Base):
    """
    Long-lived tokens specifically designed for non-interactive clients 
    (like a browser extension).
    """
    __tablename__ = "personal_access_tokens"

    id = Column(UUID(as_uuid=False), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)
    # Stored securely as a hash, just like passwords
    token_hash = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
