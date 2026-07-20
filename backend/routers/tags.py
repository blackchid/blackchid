from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
import os
import httpx
import json

from database import get_db
from models.tag import Tag
from models.tag_application import TagApplication
from models.user import User
from models.transcript_segment import TranscriptSegment
from routers.auth import get_current_user
from schemas.tag import TagCreate, TagResponse, TagApply, TagApplicationResponse, TagSuggestRequest, TagSuggestResponse
from services.permissions import require_project_role, require_tag_role

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

router = APIRouter(tags=["tags"])

@router.post("/tags", response_model=TagResponse)
def create_tag(
    tag: TagCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_project_role(db, current_user, str(tag.project_id), ["editor"])
    db_tag = Tag(
        project_id=tag.project_id,
        name=tag.name,
        color=tag.color
    )
    db.add(db_tag)
    try:
        db.commit()
        db.refresh(db_tag)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid project_id or tag already exists")
    return db_tag

@router.post("/tags/{tag_id}/apply", response_model=TagApplicationResponse)
def apply_tag(
    tag_id: str, 
    application: TagApply, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_tag_role(db, current_user, tag_id, ["editor"])
    db_app = TagApplication(
        tag_id=tag_id,
        segment_id=application.segment_id,
        note=application.note
    )
    db.add(db_app)
    try:
        db.commit()
        db.refresh(db_app)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Tag application failed (duplicate or invalid segment/tag ID)")
    return db_app

@router.delete("/tags/{tag_id}/apply/{segment_id}")
def remove_tag(
    tag_id: str, 
    segment_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_tag_role(db, current_user, tag_id, ["editor"])
    db_app = db.query(TagApplication).filter(
        TagApplication.tag_id == tag_id,
        TagApplication.segment_id == segment_id
    ).first()
    
    if not db_app:
        raise HTTPException(status_code=404, detail="Tag application not found")
        
    db.delete(db_app)
    db.commit()
    return {"status": "success"}

@router.post("/projects/{project_id}/tags/suggest", response_model=TagSuggestResponse)
async def suggest_tags(
    project_id: str,
    request: TagSuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Suggest tags for a given transcript segment using a local Ollama instance.
    Fetches the surrounding conversational context for better accuracy.
    Requires editor or viewer permissions on the project.
    """
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
    
    # 1. Fetch the target segment
    target_segment = db.query(TranscriptSegment).filter(
        TranscriptSegment.id == request.segment_id
    ).first()
    
    if not target_segment:
        raise HTTPException(status_code=404, detail="Segment not found")
        
    # 2. Fetch context segments (same recording, ordered by time)
    all_segments = db.query(TranscriptSegment).filter(
        TranscriptSegment.recording_id == target_segment.recording_id
    ).order_by(TranscriptSegment.start_time).all()
    
    # Find index of target
    target_idx = 0
    for i, seg in enumerate(all_segments):
        if seg.id == target_segment.id:
            target_idx = i
            break
            
    # Slicing context: up to 3 before, 1 after
    start_idx = max(0, target_idx - 3)
    end_idx = min(len(all_segments), target_idx + 2)
    context_segments = all_segments[start_idx:end_idx]
    
    # 3. Format the context string
    context_str_parts = []
    for seg in context_segments:
        speaker = seg.speaker_label or "Unknown Speaker"
        prefix = "--> [TARGET] " if seg.id == target_segment.id else ""
        context_str_parts.append(f"{prefix}{speaker}: {seg.text}")
        
    context_str = "\n".join(context_str_parts)
    
    prompt = f"""You are an expert UX Researcher. Analyze the conversational context below.
Pay special attention to the line marked "--> [TARGET]".
Based on the TARGET line and the surrounding context, provide 3-5 concise, specific tags that categorize the user's feedback or behavior. 
Return ONLY a JSON array of strings (e.g. ["pricing", "ui issue"]). No markdown formatting, no explanations.

Context:
{context_str}
"""
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": "llama3",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            # The response 'response' key holds the text from Ollama
            response_text = data.get("response", "[]").strip()
            
            # Since we requested format: json, it should be parsable
            try:
                suggestions = json.loads(response_text)
                if not isinstance(suggestions, list):
                    suggestions = []
                # Ensure they are all strings
                suggestions = [str(s).lower() for s in suggestions]
            except json.JSONDecodeError:
                suggestions = []
                
            return TagSuggestResponse(suggestions=suggestions[:5])
            
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Failed to connect to local AI service. Ensure Ollama is running at {OLLAMA_BASE_URL}. Error: {str(e)}"
        )
