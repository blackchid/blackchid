"""
models/__init__.py

Import all models here so that:
  1. Alembic's autogenerate can discover every table through Base.metadata
  2. Anywhere that does `from models import Project` just works
"""

from .base import Base                            # noqa: F401
from .project import Project                      # noqa: F401
from .recording import Recording                  # noqa: F401
from .transcript_segment import TranscriptSegment # noqa: F401
from .tag import Tag                              # noqa: F401
from .tag_application import TagApplication       # noqa: F401
from .user import User                            # noqa: F401
from .project_member import ProjectMember         # noqa: F401
from .insight import Insight                      # noqa: F401
from .insight_evidence import InsightEvidence     # noqa: F401
from .pii_detection import PIIDetection           # noqa: F401
from .audit_log import AuditLog                   # noqa: F401

__all__ = [
    "Base",
    "Project",
    "Recording",
    "TranscriptSegment",
    "Tag",
    "TagApplication",
    "User",
    "ProjectMember",
    "Insight",
    "InsightEvidence",
    "PIIDetection",
    "AuditLog",
]
