import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.project import Project
from models.recording import Recording
from models.tag import Tag
from models.tag_application import TagApplication
from models.transcript_segment import TranscriptSegment
from models.user import User
from models.audit_log import AuditLog
from models.pii_detection import PIIDetection
from models.insight_evidence import InsightEvidence
from pathlib import Path
from routers.auth import get_current_user
from schemas.recording import RecordingResponse, TranscriptSegmentResponse, RecordingConsentUpdate
from schemas.tag import TagApplicationDetail
from services.permissions import require_project_role, require_recording_role
from services.transcription import process_recording

router = APIRouter(tags=["recordings"])

UPLOAD_DIR = "uploads"

@router.post("/projects/{project_id}/recordings", response_model=RecordingResponse, status_code=202)
def upload_recording(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    consent_recording: bool = Form(False),
    consent_external_sharing: bool = Form(False),
    consent_ai_processing: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an audio/video file to a project.
    Creates a Recording record in 'pending' status and launches transcription in the background.
    Requires editor role.
    """
    require_project_role(db, current_user, project_id, ["editor"])
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create the recording entry first to get an ID
    recording = Recording(
        project_id=project_id,
        filename=file.filename or "unknown",
        status="pending",
        consent_recording=consent_recording,
        consent_external_sharing=consent_external_sharing,
        consent_ai_processing=consent_ai_processing
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

@router.patch("/recordings/{recording_id}/consent", response_model=RecordingResponse)
def update_recording_consent(
    recording_id: str,
    body: RecordingConsentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update consent flags for a recording.
    Requires editor role.
    """
    require_recording_role(db, current_user, recording_id, ["editor"])
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if body.consent_recording is not None:
        recording.consent_recording = body.consent_recording
    if body.consent_external_sharing is not None:
        recording.consent_external_sharing = body.consent_external_sharing
    if body.consent_ai_processing is not None:
        recording.consent_ai_processing = body.consent_ai_processing

    db.commit()
    db.refresh(recording)
    return recording

@router.get("/recordings/{recording_id}", response_model=RecordingResponse)
def get_recording_status(
    recording_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check the status of a recording. The frontend polls this until 'done'."""
    require_recording_role(db, current_user, recording_id, ["editor", "viewer"])
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    return recording

@router.get("/recordings/{recording_id}/transcript", response_model=List[TranscriptSegmentResponse])
def get_recording_transcript(
    recording_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all transcript segments for a recording, sorted by start_time."""
    require_recording_role(db, current_user, recording_id, ["editor", "viewer"])
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
        
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.recording_id == recording_id)
        .order_by(TranscriptSegment.start_time)
        .all()
    )
    return segments

@router.get("/recordings/{recording_id}/audio")
def stream_audio(
    recording_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Stream the ORIGINAL (unredacted) audio file for a recording.

    Access control: EDITOR ONLY.
    Viewers should receive the redacted export via POST /recordings/{id}/redact.
    This separation ensures the original containing PII is never exposed to
    project members who haven't been granted full access.

    FastAPI's FileResponse honours Range requests, letting WaveSurfer seek.
    """
    require_recording_role(db, current_user, recording_id, ["editor"])
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not recording.storage_path or not os.path.exists(recording.storage_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    # Determine MIME type from extension
    ext = os.path.splitext(recording.storage_path)[1].lower()
    mime_map = {
        ".mp3": "audio/mpeg",
        ".mp4": "audio/mp4",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
        ".mov": "video/quicktime",
    }
    media_type = mime_map.get(ext, "audio/mpeg")

    return FileResponse(
        path=recording.storage_path,
        media_type=media_type,
        filename=recording.filename,
        headers={"Accept-Ranges": "bytes"},
    )

@router.delete("/recordings/{recording_id}")
def delete_recording(
    recording_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Completely and verifiably erase a recording and all derived data.
    Includes media files, transcript segments, tag applications, PII detections,
    and insight evidence. Leaves an immutable audit log entry.
    Requires editor role.
    """
    require_recording_role(db, current_user, recording_id, ["editor"])
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Count derived entities for the audit log summary
    segments_count = db.query(TranscriptSegment).filter(TranscriptSegment.recording_id == recording_id).count()
    
    tags_count = (
        db.query(TagApplication)
        .join(TranscriptSegment)
        .filter(TranscriptSegment.recording_id == recording_id)
        .count()
    )
    
    pii_count = (
        db.query(PIIDetection)
        .join(TranscriptSegment)
        .filter(TranscriptSegment.recording_id == recording_id)
        .count()
    )
    
    evidence_count = (
        db.query(InsightEvidence)
        .join(TranscriptSegment)
        .filter(TranscriptSegment.recording_id == recording_id)
        .count()
    )

    # Note files to delete
    files_to_delete = []
    if recording.storage_path:
        files_to_delete.append(recording.storage_path)
        # Redacted file convention: stem_redacted.ext
        src = Path(recording.storage_path)
        redacted_path = str(src.parent / f"{src.stem}_redacted{src.suffix}")
        files_to_delete.append(redacted_path)

    # Log the erasure action BEFORE deleting the database records
    summary = {
        "recording_id": recording_id,
        "segments_deleted": segments_count,
        "tag_applications_deleted": tags_count,
        "pii_detections_deleted": pii_count,
        "insight_evidence_deleted": evidence_count,
        "files_targeted": files_to_delete
    }

    audit_entry = AuditLog(
        project_id=recording.project_id,
        recording_id=recording_id,
        user_id=current_user.id,
        action="recording_erased",
        details=summary
    )
    db.add(audit_entry)
    db.commit()

    # Delete files from disk
    files_deleted = 0
    for fpath in files_to_delete:
        if os.path.exists(fpath):
            try:
                os.unlink(fpath)
                files_deleted += 1
            except Exception:
                pass

    summary["files_deleted"] = files_deleted

    # Delete the recording (cascades to segments, tags, pii, and evidence)
    db.delete(recording)
    db.commit()

    return summary

@router.get("/recordings/{recording_id}/tag-applications", response_model=List[TagApplicationDetail])
def get_recording_tag_applications(
    recording_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return all tag applications for every segment in this recording.
    One query with a join — no N+1. The frontend uses this to render
    tag chips on each segment row without separate per-segment fetches.
    """
    require_recording_role(db, current_user, recording_id, ["editor", "viewer"])
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    rows = (
        db.query(
            TagApplication.id,
            TagApplication.segment_id,
            TagApplication.tag_id,
            Tag.name.label("tag_name"),
            Tag.color.label("tag_color"),
            TagApplication.note,
        )
        .join(Tag, Tag.id == TagApplication.tag_id)
        .join(TranscriptSegment, TranscriptSegment.id == TagApplication.segment_id)
        .filter(TranscriptSegment.recording_id == recording_id)
        .all()
    )

    return [
        TagApplicationDetail(
            id=r.id,
            segment_id=r.segment_id,
            tag_id=r.tag_id,
            tag_name=r.tag_name,
            tag_color=r.tag_color,
            note=r.note,
        )
        for r in rows
    ]
