from datetime import datetime
from pydantic import BaseModel

class TagCreate(BaseModel):
    project_id: str
    name: str
    color: str | None = None

class TagResponse(BaseModel):
    id: str
    project_id: str
    name: str
    color: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TagApply(BaseModel):
    segment_id: str
    note: str | None = None

class TagApplicationResponse(BaseModel):
    id: str
    tag_id: str
    segment_id: str
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True
