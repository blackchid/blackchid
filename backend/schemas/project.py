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
