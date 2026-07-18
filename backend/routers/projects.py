from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.project import Project
from models.recording import Recording
from models.tag import Tag
from models.tag_application import TagApplication
from models.transcript_segment import TranscriptSegment
from schemas.project import ProjectCreate, ProjectResponse
from schemas.recording import RecordingResponse, TranscriptSegmentResponse
from schemas.tag import TagResponse

router = APIRouter(tags=["projects"])

@router.post("/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(
        name=project.name,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

@router.get("/projects/{project_id}/tags", response_model=List[TagResponse])
def get_project_tags(project_id: str, db: Session = Depends(get_db)):
    """List all tags that belong to a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Tag).filter(Tag.project_id == project_id).all()

@router.get("/projects/{project_id}/recordings", response_model=List[RecordingResponse])
def get_project_recordings(project_id: str, db: Session = Depends(get_db)):
    """List all recordings in a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Recording).filter(Recording.project_id == project_id).order_by(Recording.created_at.desc()).all()

@router.get("/projects/{project_id}/tags/{tag_id}/segments", response_model=List[TranscriptSegmentResponse])
def get_segments_by_tag(project_id: str, tag_id: str, db: Session = Depends(get_db)):
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch segments by joining with TagApplication
    segments = (
        db.query(TranscriptSegment)
        .join(TagApplication, TranscriptSegment.id == TagApplication.segment_id)
        .filter(TagApplication.tag_id == tag_id)
        .order_by(TranscriptSegment.start_time)
        .all()
    )
    return segments
