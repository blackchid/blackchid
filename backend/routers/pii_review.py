"""
routers/pii_review.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PII detection review workflow.  Every detection must be explicitly reviewed
by a human editor before it can be included in a redaction job.

Endpoints
---------
POST /recordings/{id}/pii/scan
    Run Presidio against all transcript segments of a recording.
    Stores new detections as 'pending'.  Idempotent — skips segments that
    already have detections for the same offset range.

GET /recordings/{id}/pii
    List all detections for a recording with review_status, resolved time
    window, and matched text.  Filterable by status.

PATCH /pii-detections/{detection_id}
    Confirm or dismiss a single detection.  Editor-only.

DELETE /pii-detections/{detection_id}
    Remove a detection entirely (e.g. obvious false positive).  Editor-only.

Access control matrix
---------------------
| Action                       | Editor | Viewer |
|------------------------------|--------|--------|
| Scan for PII                 |   ✅   |   ❌  |
| List detections              |   ✅   |   ✅  |
| Confirm/Dismiss              |   ✅   |   ❌  |
| Delete detection             |   ✅   |   ❌  |
"""

from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.pii_detection import PIIDetection
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from models.user import User
from routers.auth import get_current_user
from services.permissions import require_recording_role
from services.pii import process_and_store_pii
from services.pii_timing import char_offset_to_time

router = APIRouter(tags=["pii-review"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class PIIDetectionResponse(BaseModel):
    id: str
    segment_id: str
    entity_type: str
    start_char: int
    end_char: int
    confidence: float
    review_status: str               # pending | confirmed | dismissed
    reviewed_by: Optional[str]
    # Derived fields (resolved at query time)
    matched_text: str
    segment_text: str
    time_start: float
    time_end: float

    class Config:
        from_attributes = True


class ReviewAction(BaseModel):
    """Body for PATCH /pii-detections/{id}."""
    action: Literal["confirm", "dismiss"]


class ScanResponse(BaseModel):
    recording_id: str
    segments_scanned: int
    new_detections: int
    total_pending: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich(det: PIIDetection, segment: TranscriptSegment) -> PIIDetectionResponse:
    """Build a PIIDetectionResponse, resolving the audio time window."""
    t_start, t_end = char_offset_to_time(
        segment_text=segment.text,
        word_timestamps=segment.word_timestamps,
        char_start=det.start_char,
        char_end=det.end_char,
        fallback_start=segment.start_time,
        fallback_end=segment.end_time,
    )
    return PIIDetectionResponse(
        id=det.id,
        segment_id=det.segment_id,
        entity_type=det.entity_type,
        start_char=det.start_char,
        end_char=det.end_char,
        confidence=det.confidence,
        review_status=det.review_status,
        reviewed_by=det.reviewed_by,
        matched_text=segment.text[det.start_char:det.end_char],
        segment_text=segment.text,
        time_start=t_start,
        time_end=t_end,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/recordings/{recording_id}/pii/scan", response_model=ScanResponse)
def scan_for_pii(
    recording_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run Presidio against all transcript segments of a recording and store
    detected PII as 'pending' review.

    Idempotent: if a segment already has detections for the same
    (start_char, end_char) range, those are not duplicated.

    Requires editor role.
    """
    require_recording_role(db, current_user, recording_id, ["editor"])

    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    if recording.status != "done":
        raise HTTPException(
            status_code=422,
            detail=f"Recording is not yet transcribed (status: {recording.status!r}). "
                   "Run transcription first.",
        )

    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.recording_id == recording_id)
        .order_by(TranscriptSegment.start_time)
        .all()
    )

    segments_scanned = 0
    new_detections = 0

    for segment in segments:
        if not segment.text.strip():
            continue

        # Fetch existing detection offsets for this segment to avoid duplication
        existing = db.query(PIIDetection).filter(
            PIIDetection.segment_id == segment.id
        ).all()
        existing_offsets = {(d.start_char, d.end_char) for d in existing}

        detections = process_and_store_pii(db, segment.id, segment.text)

        # process_and_store_pii already committed — count genuinely new ones
        # (those not in existing_offsets are new; the service may have written duplicates
        # if called twice without the idempotency guard above — we handle it here)
        for det in detections:
            if (det.start_char, det.end_char) not in existing_offsets:
                new_detections += 1
            else:
                # Remove the duplicate the service just wrote
                db.delete(det)

        db.commit()
        segments_scanned += 1

    total_pending = (
        db.query(PIIDetection)
        .join(TranscriptSegment)
        .filter(
            TranscriptSegment.recording_id == recording_id,
            PIIDetection.review_status == "pending",
        )
        .count()
    )

    return ScanResponse(
        recording_id=recording_id,
        segments_scanned=segments_scanned,
        new_detections=new_detections,
        total_pending=total_pending,
    )


@router.get("/recordings/{recording_id}/pii", response_model=List[PIIDetectionResponse])
def list_pii_detections(
    recording_id: str,
    status: Optional[str] = Query(
        None,
        description="Filter by review_status: pending | confirmed | dismissed. "
                    "Omit for all.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all PII detections for a recording, with resolved audio time windows.
    Both editors and viewers may read this.
    """
    require_recording_role(db, current_user, recording_id, ["editor", "viewer"])

    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if status and status not in ("pending", "confirmed", "dismissed"):
        raise HTTPException(status_code=422, detail="status must be pending, confirmed, or dismissed")

    q = (
        db.query(PIIDetection, TranscriptSegment)
        .join(TranscriptSegment, TranscriptSegment.id == PIIDetection.segment_id)
        .filter(TranscriptSegment.recording_id == recording_id)
    )
    if status:
        q = q.filter(PIIDetection.review_status == status)

    q = q.order_by(TranscriptSegment.start_time, PIIDetection.start_char)

    return [_enrich(det, seg) for det, seg in q.all()]


@router.patch("/pii-detections/{detection_id}", response_model=PIIDetectionResponse)
def review_detection(
    detection_id: str,
    body: ReviewAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm or dismiss a single PII detection.

    - confirm  → marks the detection as reviewed and eligible for redaction
    - dismiss  → marks it as a false positive; it will be excluded from redaction jobs

    Requires editor role on the recording's project.
    """
    detection = db.query(PIIDetection).filter(PIIDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="PII detection not found")

    segment = db.query(TranscriptSegment).filter(
        TranscriptSegment.id == detection.segment_id
    ).first()

    # Permissions — derive project from the segment's recording
    require_recording_role(db, current_user, segment.recording_id, ["editor"])

    new_status = "confirmed" if body.action == "confirm" else "dismissed"
    detection.review_status = new_status
    detection.reviewed_by = current_user.id
    db.commit()
    db.refresh(detection)

    return _enrich(detection, segment)


@router.delete("/pii-detections/{detection_id}", status_code=204)
def delete_detection(
    detection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently delete a PII detection (e.g. obvious false positive that
    shouldn't clutter the review queue).  Requires editor role.
    """
    detection = db.query(PIIDetection).filter(PIIDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="PII detection not found")

    segment = db.query(TranscriptSegment).filter(
        TranscriptSegment.id == detection.segment_id
    ).first()
    require_recording_role(db, current_user, segment.recording_id, ["editor"])

    db.delete(detection)
    db.commit()
