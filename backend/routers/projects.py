from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.project import Project
from models.tag_application import TagApplication
from models.transcript_segment import TranscriptSegment
from schemas.project import ProjectCreate, ProjectResponse
from schemas.recording import TranscriptSegmentResponse

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
