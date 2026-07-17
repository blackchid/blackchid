from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from database import get_db
from models.tag import Tag
from models.tag_application import TagApplication
from schemas.tag import TagCreate, TagResponse, TagApply, TagApplicationResponse

router = APIRouter(tags=["tags"])

@router.post("/tags", response_model=TagResponse)
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
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
def apply_tag(tag_id: str, application: TagApply, db: Session = Depends(get_db)):
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
def remove_tag(tag_id: str, segment_id: str, db: Session = Depends(get_db)):
    db_app = db.query(TagApplication).filter(
        TagApplication.tag_id == tag_id,
        TagApplication.segment_id == segment_id
    ).first()
    
    if not db_app:
        raise HTTPException(status_code=404, detail="Tag application not found")
        
    db.delete(db_app)
    db.commit()
    return {"status": "success"}
