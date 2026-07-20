from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from models.base import Base

class AuditLog(Base):
    """
    Immutable audit log for tracking redaction and PII review actions.
    Append-only by design to prove due diligence to compliance reviewers.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    recording_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Action type (e.g., 'pii_scan_run', 'pii_detection_confirmed', 'pii_detection_dismissed', 'redaction_executed')
    action = Column(String, nullable=False, index=True)
    
    # Flexible structured payload for details (what was detected, what got muted, etc.)
    details = Column(JSONB, nullable=False, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
