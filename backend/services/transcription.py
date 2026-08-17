import os
import logging
import traceback
from sqlalchemy.orm import Session
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from database import SessionLocal

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_SIZE  = os.environ.get("WHISPER_MODEL", "small")
DEVICE      = "cpu"
COMPUTE     = "float32"
BATCH_SIZE  = 16


def _load_audio_safe(audio_path: str):
    """
    Load audio using whisperx's built-in loader (which shells out to ffmpeg).
    Falls back to soundfile if whisperx.load_audio fails.
    """
    import whisperx
    try:
        return whisperx.load_audio(audio_path)
    except Exception as exc:
        logger.warning(f"whisperx.load_audio failed ({exc}), trying soundfile fallback...")
        import soundfile as sf
        import numpy as np
        data, sr = sf.read(audio_path, dtype="float32", always_2d=False)
        # whisperx expects mono float32 at 16 kHz
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr != 16000:
            import librosa
            data = librosa.resample(data, orig_sr=sr, target_sr=16000)
        return data


def _set_error(db: Session, recording_id: str, message: str) -> None:
    """Safely mark a recording as errored and store a human-readable message."""
    try:
        db.rollback()
        rec = db.query(Recording).filter(Recording.id == recording_id).first()
        if rec:
            rec.status = "error"
            # Store the error message in the existing `storage_path` column as a
            # JSON-encoded sentinel only if no real path exists, OR use a dedicated
            # error_message column if one exists on the model.
            if hasattr(rec, "error_message"):
                rec.error_message = message[:1000]
            db.commit()
    except Exception as inner:
        logger.error(f"Could not update recording {recording_id} to error state: {inner}")


def process_recording(recording_id: str, audio_path: str) -> None:
    """
    Background task: transcribe → align → (optionally) diarize → embed → save.

    Failure strategy:
    - Missing HF_TOKEN     → skip diarization, label all segments "SPEAKER_0"
    - Alignment failure    → skip alignment, use raw whisper segments
    - Diarization failure  → skip diarization, label segments sequentially
    - Any other error      → mark recording as 'error', log full traceback
    """
    db: Session = SessionLocal()

    try:
        recording = db.query(Recording).filter(Recording.id == recording_id).first()
        if not recording:
            logger.error(f"Recording {recording_id} not found in DB.")
            return

        # ── 1. Set status → processing ────────────────────────────────────────
        recording.status = "processing"
        db.commit()

        # Validate file exists
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found on disk: {audio_path}")

        # ── 2. Lazy-import heavy models ───────────────────────────────────────
        import whisperx  # noqa: PLC0415

        # ── 3. Transcribe ─────────────────────────────────────────────────────
        logger.info(f"[{recording_id[:8]}] Loading WhisperX model '{MODEL_SIZE}'...")
        model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE)

        logger.info(f"[{recording_id[:8]}] Transcribing '{audio_path}'...")
        # Load audio separately to surface decode errors early
        audio = _load_audio_safe(audio_path)
        result = model.transcribe(audio, batch_size=BATCH_SIZE)
        language = result.get("language", "en")
        raw_segments = result.get("segments", [])

        if not raw_segments:
            logger.warning(f"[{recording_id[:8]}] No segments returned by WhisperX.")
            recording.status = "done"
            recording.duration_seconds = 0
            db.commit()
            return

        # ── 4. Alignment (non-fatal) ──────────────────────────────────────────
        aligned = result
        try:
            logger.info(f"[{recording_id[:8]}] Aligning for language '{language}'...")
            align_model, align_meta = whisperx.load_align_model(
                language_code=language, device=DEVICE
            )
            aligned = whisperx.align(
                raw_segments, align_model, align_meta, audio, DEVICE,
                return_char_alignments=False,
            )
            logger.info(f"[{recording_id[:8]}] Alignment complete.")
        except Exception as exc:
            logger.warning(
                f"[{recording_id[:8]}] Alignment skipped (language='{language}'): {exc}"
            )

        # ── 5. Diarization (non-fatal — requires HF_TOKEN) ───────────────────
        final_segments = aligned.get("segments", raw_segments)
        hf_token = os.environ.get("HF_TOKEN", "").strip()

        if hf_token:
            try:
                logger.info(f"[{recording_id[:8]}] Running speaker diarization...")
                from whisperx.diarize import DiarizationPipeline  # noqa: PLC0415
                diarize_model = DiarizationPipeline(token=hf_token, device=DEVICE)
                diarize_segments = diarize_model(audio)
                final = whisperx.assign_word_speakers(diarize_segments, aligned)
                final_segments = final.get("segments", raw_segments)
                logger.info(f"[{recording_id[:8]}] Diarization complete.")
            except Exception as exc:
                logger.warning(
                    f"[{recording_id[:8]}] Diarization failed (will label as SPEAKER_0): {exc}"
                )
                # Fall back: all segments get a single speaker label
                for seg in final_segments:
                    seg.setdefault("speaker", "SPEAKER_0")
        else:
            logger.warning(
                f"[{recording_id[:8]}] HF_TOKEN not set — skipping diarization. "
                "Set HF_TOKEN env var to enable speaker labels."
            )
            for seg in final_segments:
                seg.setdefault("speaker", "SPEAKER_0")

        # ── 6. Build DB objects ───────────────────────────────────────────────
        db_segments = []
        for seg in final_segments:
            text = seg.get("text", "").strip()
            if not text:
                continue
            db_segments.append(
                TranscriptSegment(
                    recording_id=recording_id,
                    start_time=float(seg.get("start", 0)),
                    end_time=float(seg.get("end", 0)),
                    speaker_label=seg.get("speaker", "SPEAKER_0"),
                    text=text,
                    word_timestamps=seg.get("words"),
                )
            )

        # ── 7. Embeddings (non-fatal) ─────────────────────────────────────────
        if db_segments:
            try:
                from services.embeddings import generate_embeddings  # noqa: PLC0415
                logger.info(f"[{recording_id[:8]}] Generating embeddings for {len(db_segments)} segments...")
                texts = [s.text for s in db_segments]
                embeddings = generate_embeddings(texts)
                for i, seg in enumerate(db_segments):
                    if i < len(embeddings) and embeddings[i]:
                        seg.embedding = embeddings[i]
            except Exception as exc:
                logger.warning(f"[{recording_id[:8]}] Embedding generation failed (non-fatal): {exc}")

        # ── 8. Persist ────────────────────────────────────────────────────────
        if db_segments:
            db.bulk_save_objects(db_segments)
            recording.duration_seconds = max(s.end_time for s in db_segments)
        else:
            recording.duration_seconds = 0

        recording.status = "done"
        db.commit()
        logger.info(
            f"[{recording_id[:8]}] Done — {len(db_segments)} segments, "
            f"duration={recording.duration_seconds:.1f}s"
        )

    except Exception as exc:
        short = str(exc)[:200]
        full  = traceback.format_exc()
        logger.error(f"[{recording_id[:8]}] FAILED: {short}\n{full}")
        _set_error(db, recording_id, short)
    finally:
        db.close()
