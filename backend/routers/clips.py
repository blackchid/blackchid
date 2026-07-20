import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.project import Project
from models.clipped_evidence import ClippedEvidence
from models.user import User
from routers.auth import get_current_user
from schemas.clipped_evidence import ClippedEvidenceResponse
from services.permissions import require_project_role

router = APIRouter(tags=["clips"])

CLIPS_UPLOAD_DIR = Path("uploads/clips")
CLIPS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/projects/{project_id}/clips", response_model=ClippedEvidenceResponse, status_code=201)
def create_clipped_evidence(
    project_id: str,
    quote: str = Form(...),
    source_url: str | None = Form(None),
    note: str | None = Form(None),
    screenshot: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Store evidence clipped via the browser extension.
    Requires an active user token (JWT or PAT) and editor or viewer role on the project.
    """
    # Verify they have access to the project
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
    
    screenshot_path = None
    if screenshot:
        file_ext = Path(screenshot.filename).suffix if screenshot.filename else ".png"
        import uuid
        filename = f"{uuid.uuid4()}{file_ext}"
        filepath = CLIPS_UPLOAD_DIR / filename
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(screenshot.file, buffer)
        screenshot_path = str(filepath)
    
    clip = ClippedEvidence(
        project_id=project_id,
        user_id=current_user.id,
        quote=quote,
        source_url=source_url,
        note=note,
        screenshot_path=screenshot_path
    )
    
    db.add(clip)
    db.commit()
    db.refresh(clip)
    
    return clip
