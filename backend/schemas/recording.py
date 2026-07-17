from datetime import datetime
from pydantic import BaseModel, Field

class RecordingResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    duration_seconds: float | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TranscriptSegmentResponse(BaseModel):
    id: str
    recording_id: str
    start_time: float
    end_time: float
    speaker_label: str | None = None
    text: str
    created_at: datetime

    class Config:
        from_attributes = True
