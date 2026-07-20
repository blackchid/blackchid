from datetime import datetime
from pydantic import BaseModel

class ClippedEvidenceResponse(BaseModel):
    id: str
    project_id: str
    user_id: str | None = None
    quote: str
    source_url: str | None = None
    note: str | None = None
    screenshot_path: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
