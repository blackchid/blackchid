from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

from schemas.recording import TranscriptSegmentResponse

from schemas.clipped_evidence import ClippedEvidenceResponse

class InsightEvidenceCreate(BaseModel):
    segment_id: str | None = None
    clip_id: str | None = None
    note: str | None = None

class InsightEvidenceResponse(BaseModel):
    id: str
    insight_id: str
    segment_id: str | None = None
    clip_id: str | None = None
    note: str | None
    created_at: datetime
    # We can include the segment or clip directly for convenience in the frontend
    segment: Optional[TranscriptSegmentResponse] = None
    clip: Optional[ClippedEvidenceResponse] = None

    class Config:
        from_attributes = True

class InsightCreate(BaseModel):
    title: str
    description: str | None = None

class InsightUpdate(BaseModel):
    title: str | None = None
    description: str | None = None

class InsightResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    evidence: List[InsightEvidenceResponse] = []

    class Config:
        from_attributes = True
