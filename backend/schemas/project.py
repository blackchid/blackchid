from datetime import datetime
from pydantic import BaseModel

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SegmentSearchMatch(BaseModel):
    segment_id: str
    recording_id: str
    speaker_label: str | None
    text: str
    start_time: float
    end_time: float
    similarity_score: float
    
class SearchResponse(BaseModel):
    query: str
    results: list[SegmentSearchMatch]

class ReelExportRequest(BaseModel):
    segment_ids: list[str]
