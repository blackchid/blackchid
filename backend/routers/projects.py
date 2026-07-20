from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.project import Project
from models.project_member import ProjectMember
from models.recording import Recording
from models.tag import Tag
from models.tag_application import TagApplication
from models.transcript_segment import TranscriptSegment
from models.user import User
from routers.auth import get_current_user
from schemas.project import ProjectCreate, ProjectResponse, SearchResponse
from schemas.recording import RecordingResponse, TranscriptSegmentResponse
from schemas.tag import TagResponse
from services.permissions import require_project_role
router = APIRouter(tags=["projects"])

@router.post("/projects", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_project = Project(
        name=project.name,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    # Creator becomes editor
    member = ProjectMember(project_id=db_project.id, user_id=current_user.id, role="editor")
    db.add(member)
    db.commit()
    
    return db_project

@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Project)
        .join(ProjectMember)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )

@router.get("/projects/{project_id}/tags", response_model=List[TagResponse])
def get_project_tags(
    project_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tags that belong to a project."""
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Tag).filter(Tag.project_id == project_id).all()

@router.get("/projects/{project_id}/recordings", response_model=List[RecordingResponse])
def get_project_recordings(
    project_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all recordings in a project."""
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Recording).filter(Recording.project_id == project_id).order_by(Recording.created_at.desc()).all()

@router.get("/projects/{project_id}/tags/{tag_id}/segments", response_model=List[TranscriptSegmentResponse])
def get_segments_by_tag(
    project_id: str, 
    tag_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
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

from services.embeddings import generate_embeddings

@router.get("/projects/{project_id}/search", response_model=SearchResponse)
def semantic_search(
    project_id: str,
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search project transcripts semantically using pgvector cosine distance.
    Returns the top 10 matching segments.
    """
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
    
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    # Generate embedding for the search query
    query_vectors = generate_embeddings([q])
    if not query_vectors or not query_vectors[0]:
        raise HTTPException(status_code=500, detail="Failed to generate embedding for query")
    query_vector = query_vectors[0]
    
    # Perform vector search using cosine distance (<=>)
    # Cosine distance = 1 - cosine similarity
    # We join with Recording to ensure the segment belongs to the specified project_id
    results = (
        db.query(
            TranscriptSegment, 
            TranscriptSegment.embedding.cosine_distance(query_vector).label("distance")
        )
        .join(Recording)
        .filter(Recording.project_id == project_id)
        .filter(TranscriptSegment.embedding.is_not(None))
        .order_by(TranscriptSegment.embedding.cosine_distance(query_vector))
        .limit(10)
        .all()
    )
    
    matches = []
    for segment, distance in results:
        matches.append({
            "segment_id": segment.id,
            "recording_id": segment.recording_id,
            "speaker_label": segment.speaker_label,
            "text": segment.text,
            "start_time": segment.start_time,
            "end_time": segment.end_time,
            "similarity_score": 1.0 - float(distance)  # Convert distance to similarity
        })
        
    return SearchResponse(query=q, results=matches)
