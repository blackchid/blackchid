import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models.project import Project
from models.recording import Recording
from schemas.recording import RecordingResponse
from services.transcription import process_recording

router = APIRouter(tags=["recordings"])

UPLOAD_DIR = "/app/uploads"

@router.post("/projects/{project_id}/recordings", response_model=RecordingResponse)
async def upload_recording(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload an audio file for a project, save it, and start transcription in the background.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create the recording entry first to get an ID
    recording = Recording(
        project_id=project_id,
        filename=file.filename or "unknown",
        status="pending"
    )
    db.add(recording)
    db.flush() # flush to get the ID without fully committing yet

    # Save the file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_extension = os.path.splitext(file.filename or "")[1]
    safe_filename = f"{project_id}_{recording.id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    recording.storage_path = file_path
    db.commit()
    db.refresh(recording)

    # Queue the background task
    background_tasks.add_task(process_recording, recording.id, file_path)

    return recording

@router.get("/recordings/{recording_id}", response_model=RecordingResponse)
def get_recording(recording_id: str, db: Session = Depends(get_db)):
    """
    Get the status of a recording.
    """
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    return recording
