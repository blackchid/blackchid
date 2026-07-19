import os
import sys
import logging
from sqlalchemy.orm import Session
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from database import SessionLocal

logger = logging.getLogger(__name__)

def process_recording(recording_id: str, audio_path: str):
    """
    Background task to transcribe, align, and diarize an audio file.
    Updates the recording status in the database.
    """
    # Create a local session for the background task
    db: Session = SessionLocal()
    
    try:
        recording = db.query(Recording).filter(Recording.id == recording_id).first()
        if not recording:
            logger.error(f"Recording {recording_id} not found in DB.")
            return

        recording.status = "processing"
        db.commit()

        # ── Lazy import to avoid loading models until needed ──────────────────
        import whisperx
        from whisperx.diarize import DiarizationPipeline
        
        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise RuntimeError("HF_TOKEN environment variable is missing.")

        MODEL_SIZE = "small"
        DEVICE = "cpu"
        COMPUTE = "float32"
        BATCH_SIZE = 16

        logger.info(f"Loading WhisperX '{MODEL_SIZE}' model...")
        model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE)

        logger.info(f"Transcribing {audio_path}...")
        result = model.transcribe(audio_path, batch_size=BATCH_SIZE)
        language = result.get("language", "unknown")
        segments = result.get("segments", [])

        logger.info("Aligning segments...")
        try:
            align_model, align_metadata = whisperx.load_align_model(
                language_code=language, device=DEVICE
            )
            aligned = whisperx.align(
                segments, align_model, align_metadata, audio_path, DEVICE,
                return_char_alignments=False,
            )
        except ValueError as exc:
            logger.warning(f"No alignment model for '{language}': {exc}. Continuing without word-level alignment.")
            aligned = result
            
        logger.info("Running diarization...")
        diarize_model = DiarizationPipeline(token=hf_token, device=DEVICE)
        diarize_segments = diarize_model(audio_path)
        final = whisperx.assign_word_speakers(diarize_segments, aligned)
        final_segments = final.get("segments", [])

        # ── Save segments to DB ───────────────────────────────────────────────
        db_segments = []
        for seg in final_segments:
            db_segments.append(
                TranscriptSegment(
                    recording_id=recording_id,
                    start_time=seg.get("start", 0),
                    end_time=seg.get("end", 0),
                    speaker_label=seg.get("speaker", "UNKNOWN"),
                    text=seg.get("text", "").strip(),
                    # Store WhisperX word-level timestamps for precise PII mapping.
                    # Each entry: {"word": str, "start": float, "end": float, "score": float}
                    word_timestamps=seg.get("words"),
                )
            )
        
        if db_segments:
            db.bulk_save_objects(db_segments)
            # Update duration based on the last segment's end time
            recording.duration_seconds = max([s.end_time for s in db_segments])
            
        recording.status = "done"
        db.commit()
        logger.info(f"Successfully processed recording {recording_id}.")

    except Exception as exc:
        logger.error(f"Failed to process recording {recording_id}: {exc}", exc_info=True)
        # Attempt to mark as error if possible
        try:
            db.rollback()
            recording = db.query(Recording).filter(Recording.id == recording_id).first()
            if recording:
                recording.status = "error"
                # You might want to save the error message in a new column later
                db.commit()
        except Exception as inner_exc:
            logger.error(f"Could not update recording status to error: {inner_exc}")
    finally:
        db.close()
