from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from database import get_db
from models.insight import Insight
from models.insight_evidence import InsightEvidence
from models.transcript_segment import TranscriptSegment
from models.user import User
from routers.auth import get_current_user
from schemas.insight import (
    InsightCreate,
    InsightUpdate,
    InsightResponse,
    InsightEvidenceCreate,
    InsightEvidenceResponse
)
from services.permissions import require_project_role, require_insight_role

router = APIRouter(tags=["insights"])

# --- INSIGHT CRUD ---

@router.post("/projects/{project_id}/insights", response_model=InsightResponse)
def create_insight(
    project_id: str,
    insight: InsightCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_project_role(db, current_user, project_id, ["editor"])
    
    db_insight = Insight(
        project_id=project_id,
        title=insight.title,
        description=insight.description
    )
    db.add(db_insight)
    db.commit()
    db.refresh(db_insight)
    return db_insight

@router.get("/projects/{project_id}/insights", response_model=List[InsightResponse])
def list_insights(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_project_role(db, current_user, project_id, ["editor", "viewer"])
    # We could eager load evidence here if needed: 
    # .options(joinedload(Insight.evidence).joinedload(InsightEvidence.segment))
    insights = db.query(Insight).filter(Insight.project_id == project_id).order_by(Insight.created_at.desc()).all()
    
    # Manually populate evidence for response (simplest way without complex ORM relationships for now)
    for insight in insights:
        evidence = db.query(InsightEvidence).filter(InsightEvidence.insight_id == insight.id).all()
        for ev in evidence:
            ev.segment = db.query(TranscriptSegment).filter(TranscriptSegment.id == ev.segment_id).first()
        insight.evidence = evidence
        
    return insights

@router.get("/insights/{insight_id}", response_model=InsightResponse)
def get_insight(
    insight_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_insight_role(db, current_user, insight_id, ["editor", "viewer"])
    insight = db.query(Insight).filter(Insight.id == insight_id).first()
    
    evidence = db.query(InsightEvidence).filter(InsightEvidence.insight_id == insight.id).all()
    for ev in evidence:
        ev.segment = db.query(TranscriptSegment).filter(TranscriptSegment.id == ev.segment_id).first()
    insight.evidence = evidence
    
    return insight

@router.patch("/insights/{insight_id}", response_model=InsightResponse)
def update_insight(
    insight_id: str,
    updates: InsightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_insight_role(db, current_user, insight_id, ["editor"])
    insight = db.query(Insight).filter(Insight.id == insight_id).first()
    
    if updates.title is not None:
        insight.title = updates.title
    if updates.description is not None:
        insight.description = updates.description
        
    db.commit()
    db.refresh(insight)
    
    evidence = db.query(InsightEvidence).filter(InsightEvidence.insight_id == insight.id).all()
    for ev in evidence:
        ev.segment = db.query(TranscriptSegment).filter(TranscriptSegment.id == ev.segment_id).first()
    insight.evidence = evidence
    
    return insight

@router.delete("/insights/{insight_id}")
def delete_insight(
    insight_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_insight_role(db, current_user, insight_id, ["editor"])
    insight = db.query(Insight).filter(Insight.id == insight_id).first()
    db.delete(insight)
    db.commit()
    return {"status": "success"}


# --- EVIDENCE CRUD ---

@router.post("/insights/{insight_id}/evidence", response_model=InsightEvidenceResponse)
def add_evidence(
    insight_id: str,
    evidence: InsightEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_insight_role(db, current_user, insight_id, ["editor"])
    
    db_ev = InsightEvidence(
        insight_id=insight_id,
        segment_id=evidence.segment_id,
        note=evidence.note
    )
    db.add(db_ev)
    try:
        db.commit()
        db.refresh(db_ev)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Evidence already attached or invalid segment")
        
    db_ev.segment = db.query(TranscriptSegment).filter(TranscriptSegment.id == db_ev.segment_id).first()
    return db_ev

@router.delete("/insights/{insight_id}/evidence/{segment_id}")
def remove_evidence(
    insight_id: str,
    segment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_insight_role(db, current_user, insight_id, ["editor"])
    ev = db.query(InsightEvidence).filter(
        InsightEvidence.insight_id == insight_id,
        InsightEvidence.segment_id == segment_id
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    db.delete(ev)
    db.commit()
    return {"status": "success"}
