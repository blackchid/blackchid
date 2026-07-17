"""
transcribe.py — WhisperX transcription + forced alignment (no diarization).

Produces:
  1. Segment-level output (from basic transcription)
  2. Word-level timestamps (from forced alignment)

Usage:
    python transcribe.py <audio_file>

Example:
    python transcribe.py test.mp3

Requires:
    - FFmpeg on your system  (brew install ffmpeg)
    - pip install -r requirements.txt
"""

import sys
import warnings

# Suppress the benign torchcodec/FFmpeg warning from pyannote at import time
warnings.filterwarnings("ignore", message="torchcodec is not installed correctly")

import whisperx


def print_separator(char: str = "─", width: int = 64) -> None:
    print(char * width)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file>")
        sys.exit(1)

    audio_path = sys.argv[1]

    # ── Config ───────────────────────────────────────────────────────────────
    MODEL_SIZE = "small"    # tiny | base | small | medium | large-v2 | large-v3
    DEVICE     = "cpu"      # "cuda" if you have an NVIDIA GPU
    COMPUTE    = "float32"  # float16 requires CUDA; use float32 on CPU / Apple Silicon
    BATCH_SIZE = 16         # lower if you hit memory limits

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1 — Load Whisper model and transcribe
    # ─────────────────────────────────────────────────────────────────────────
    # whisperx.load_model wraps faster-whisper under the hood.
    # It also attaches a VAD (Voice Activity Detector) that first finds where
    # speech exists, so Whisper only processes real speech chunks — not silence.
    print(f"[1/3] Loading WhisperX '{MODEL_SIZE}' model …", flush=True)
    model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE)

    # model.transcribe() returns a dict:
    #   { "language": "en",
    #     "segments": [ {"text": "...", "start": 0.0, "end": 2.1}, ... ] }
    # Segments are coarse — whole sentences or phrases, NOT individual words yet.
    print(f"[2/3] Transcribing: {audio_path} …", flush=True)
    result = model.transcribe(audio_path, batch_size=BATCH_SIZE)

    language = result.get("language", "unknown")
    segments  = result.get("segments", [])

    # ── Print Step 1 output ──────────────────────────────────────────────────
    print(f"\n{'═' * 64}")
    print(f"  STEP 1 — Basic Transcription")
    print(f"{'═' * 64}")
    print(f"  Detected language : {language}")
    print(f"  Segments found    : {len(segments)}")
    print_separator()

    for seg in segments:
        t  = f"[{seg['start']:7.2f}s → {seg['end']:7.2f}s]"
        print(f"{t}  {seg['text'].strip()}")

    print_separator()

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2 — Forced Alignment (word-level timestamps)
    # ─────────────────────────────────────────────────────────────────────────
    # What is forced alignment?
    #   Whisper outputs text but only knows approximately WHEN each chunk was
    #   spoken. Forced alignment takes the text Whisper produced and the raw
    #   audio waveform, then uses a wav2vec2 acoustic model to precisely pin
    #   every word (and optionally every character) to its exact millisecond.
    #
    # load_align_model() picks the right wav2vec2 model for the detected
    # language automatically (e.g. WAV2VEC2_ASR_BASE_960H for English).
    print(f"\n[3/3] Loading alignment model for language '{language}' …", flush=True)
    align_model, align_metadata = whisperx.load_align_model(
        language_code=language,
        device=DEVICE,
    )

    # whisperx.align() takes:
    #   - segments  : the coarse segments from Step 1
    #   - model     : the wav2vec2 alignment model
    #   - metadata  : language + tokenizer dictionary
    #   - audio     : the original audio file path (re-read internally)
    #   - device    : same device as above
    #
    # Returns a new dict with the same segments, but each segment now has
    # a "words" list:
    #   { "word": "hello", "start": 1.23, "end": 1.56, "score": 0.99 }
    print(f"Aligning …", flush=True)
    aligned = whisperx.align(
        segments,
        align_model,
        align_metadata,
        audio_path,
        DEVICE,
        return_char_alignments=False,   # True would also give per-character times
    )

    aligned_segments = aligned.get("segments", [])

    # ── Print Step 2 output ──────────────────────────────────────────────────
    print(f"\n{'═' * 64}")
    print(f"  STEP 2 — Word-Level Alignment")
    print(f"{'═' * 64}")

    for seg_idx, seg in enumerate(aligned_segments, 1):
        seg_start = seg.get("start", 0)
        seg_end   = seg.get("end",   0)
        seg_text  = seg.get("text", "").strip()
        words     = seg.get("words", [])

        print(f"\n  Segment {seg_idx}: [{seg_start:.2f}s → {seg_end:.2f}s]")
        print(f"  \"{seg_text}\"")
        print_separator("·", 64)

        if words:
            # Each word dict: {"word": str, "start": float, "end": float, "score": float}
            # score = alignment confidence (0.0 – 1.0); ~0.9+ is reliable
            print(f"  {'WORD':<25} {'START':>8}   {'END':>8}   {'SCORE':>6}")
            print_separator("·", 64)
            for w in words:
                word  = w.get("word",  "?")
                start = w.get("start", None)
                end   = w.get("end",   None)
                score = w.get("score", None)

                # Some words near segment boundaries may lack timestamps
                # if the aligner couldn't confidently place them
                ts_s = f"{start:.3f}s" if start is not None else "  —    "
                ts_e = f"{end:.3f}s"   if end   is not None else "  —    "
                sc   = f"{score:.2f}"  if score is not None else "  —  "

                print(f"  {word:<25} {ts_s:>8}   {ts_e:>8}   {sc:>6}")
        else:
            print("  (no word timestamps available for this segment)")

    print(f"\n{'═' * 64}")
    print("  Done.")
    print(f"{'═' * 64}\n")


if __name__ == "__main__":
    main()
