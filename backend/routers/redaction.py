"""
routers/redaction.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /recordings/{id}/redact

Given a list of confirmed PII detection IDs, maps each detection's
character offsets to audio timestamps (using WhisperX word-level data),
then calls the FFmpeg-based audio redaction service to produce a muted
output file.  The redacted file is returned as a streaming download.

Flow
----
1. Resolve each pii_detection_id → PIIDetection row (must belong to a
   segment of this recording; 404 otherwise).
2. For each detection, call char_offset_to_time() to get (t_start, t_end).
3. Merge overlapping/adjacent time ranges.
4. Call redact_audio() → produces a new file on disk.
5. Stream it back as a FileResponse with a descriptive filename.

The original file is NOT modified.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.pii_detection import PIIDetection
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from models.user import User
from routers.auth import get_current_user
from services.audio_redaction import redact_audio, _merge_ranges
from services.permissions import require_recording_role
from services.pii_timing import char_offset_to_time

router = APIRouter(tags=["redaction"])


# ── Request / Response schemas ────────────────────────────────────────────────

class RedactRequest(BaseModel):
    """
    Body for POST /recordings/{id}/redact.

    pii_detection_ids: list of PIIDetection UUIDs to redact.
    padding_seconds:   optional silence padding around each muted span
                       (default 0.15 s — covers coarticulation).
    """
    pii_detection_ids: List[str]
    padding_seconds: float = 0.15


class RedactPreviewItem(BaseModel):
    pii_detection_id: str
    entity_type: str
    matched_text: str
    time_start: float
    time_end: float


class RedactPreviewResponse(BaseModel):
    """
    GET /recordings/{id}/redact/preview

    Returns the resolved time windows without actually producing a file.
    Lets the frontend show the user what will be muted before they confirm.
    """
    recording_id: str
    spans: List[RedactPreviewItem]


# ── Helpers ───────────────────────────────────────────────────────────────────



def _resolve_detections(
    db: Session,
    recording_id: str,
    detection_ids: list[str],
    padding: float,
) -> list[tuple[float, float]]:
    """
    For each detection ID, resolve to a (time_start, time_end) span.
    Raises 404 if any ID doesn't exist or doesn't belong to this recording.
    """
    time_ranges: list[tuple[float, float]] = []

    for det_id in detection_ids:
        detection: PIIDetection | None = (
            db.query(PIIDetection).filter(PIIDetection.id == det_id).first()
        )
        if detection is None:
            raise HTTPException(status_code=404, detail=f"PII detection {det_id!r} not found")

        segment: TranscriptSegment | None = (
            db.query(TranscriptSegment)
            .filter(TranscriptSegment.id == detection.segment_id)
            .first()
        )
        if segment is None or segment.recording_id != recording_id:
            raise HTTPException(
                status_code=404,
                detail=f"PII detection {det_id!r} does not belong to recording {recording_id!r}",
            )

        t_start, t_end = char_offset_to_time(
            segment_text=segment.text,
            word_timestamps=segment.word_timestamps,
            char_start=detection.start_char,
            char_end=detection.end_char,
            fallback_start=segment.start_time,
            fallback_end=segment.end_time,
        )

        # Apply padding (clip to 0)
        t_start = max(0.0, t_start - padding)
        t_end = t_end + padding

        time_ranges.append((t_start, t_end))

    return _merge_ranges(time_ranges)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/recordings/{recording_id}/redact/preview", response_model=RedactPreviewResponse)
def preview_redaction(
    recording_id: str,
    pii_detection_ids: str,   # comma-separated in query string for GET
    padding_seconds: float = 0.15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Preview the time spans that would be muted without producing a file.
    pii_detection_ids: comma-separated UUIDs, e.g. ?pii_detection_ids=abc,def
    """
    require_recording_role(db, current_user, recording_id, ["editor", "viewer"])

    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    ids = [i.strip() for i in pii_detection_ids.split(",") if i.strip()]
    if not ids:
        raise HTTPException(status_code=422, detail="pii_detection_ids must not be empty")

    # Build per-detection preview (before merging) so UI can show individual entities
    items: list[RedactPreviewItem] = []
    for det_id in ids:
        detection = db.query(PIIDetection).filter(PIIDetection.id == det_id).first()
        if not detection:
            raise HTTPException(status_code=404, detail=f"PII detection {det_id!r} not found")
        segment = db.query(TranscriptSegment).filter(TranscriptSegment.id == detection.segment_id).first()
        if not segment or segment.recording_id != recording_id:
            raise HTTPException(status_code=404, detail=f"Detection {det_id!r} not in this recording")

        t_start, t_end = char_offset_to_time(
            segment_text=segment.text,
            word_timestamps=segment.word_timestamps,
            char_start=detection.start_char,
            char_end=detection.end_char,
            fallback_start=segment.start_time,
            fallback_end=segment.end_time,
        )
        items.append(RedactPreviewItem(
            pii_detection_id=det_id,
            entity_type=detection.entity_type,
            matched_text=segment.text[detection.start_char:detection.end_char],
            time_start=max(0.0, t_start - padding_seconds),
            time_end=t_end + padding_seconds,
        ))

    return RedactPreviewResponse(recording_id=recording_id, spans=items)


@router.post("/recordings/{recording_id}/redact")
def redact_recording(
    recording_id: str,
    body: RedactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Produce a redacted (muted) version of the recording audio.

    - Resolves each PII detection ID to a precise audio time window.
    - Merges overlapping windows.
    - Runs FFmpeg to mute those windows.
    - Streams the resulting file back as a download.

    The original file is not modified.
    Requires editor role.
    """
    require_recording_role(db, current_user, recording_id, ["editor"])

    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not recording.storage_path or not os.path.exists(recording.storage_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
    if not body.pii_detection_ids:
        raise HTTPException(status_code=422, detail="pii_detection_ids must not be empty")

    # Resolve detections → merged time windows
    time_ranges = _resolve_detections(
        db, recording_id, body.pii_detection_ids, body.padding_seconds
    )

    # Build output path: uploads/<original_stem>_redacted.<ext>
    src = Path(recording.storage_path)
    output_path = str(src.parent / f"{src.stem}_redacted{src.suffix}")

    try:
        redacted_path = redact_audio(
            input_path=recording.storage_path,
            time_ranges=time_ranges,
            output_path=output_path,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Determine MIME type
    ext = Path(redacted_path).suffix.lower()
    mime_map = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
    }
    media_type = mime_map.get(ext, "audio/mpeg")

    download_name = f"{Path(recording.filename).stem}_redacted{ext}"

    return FileResponse(
        path=redacted_path,
        media_type=media_type,
        filename=download_name,
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )
