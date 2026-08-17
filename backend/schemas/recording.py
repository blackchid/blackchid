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
    
    consent_recording: bool
    consent_external_sharing: bool
    consent_ai_processing: bool

    class Config:
        from_attributes = True

class RecordingConsentUpdate(BaseModel):
    consent_recording: bool | None = None
    consent_external_sharing: bool | None = None
    consent_ai_processing: bool | None = None

class TranscriptSegmentResponse(BaseModel):
    id: str
    recording_id: str
    start_time: float
    end_time: float
    speaker_label: str | None = None
    text: str
    word_timestamps: list | None = None
    created_at: datetime

    class Config:
        from_attributes = True
