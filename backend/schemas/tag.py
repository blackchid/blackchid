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

class TagApplicationDetail(BaseModel):
    """Denormalized view — tag info embedded so the frontend avoids extra requests."""
    id: str
    segment_id: str
    tag_id: str
    tag_name: str
    tag_color: str | None
    note: str | None

    class Config:
        from_attributes = True
