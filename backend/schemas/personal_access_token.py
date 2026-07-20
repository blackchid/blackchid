from pydantic import BaseModel
from datetime import datetime

class PATCreate(BaseModel):
    name: str

class PATResponse(BaseModel):
    id: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

class PATCreateResponse(PATResponse):
    token: str  # Only returned once on creation
