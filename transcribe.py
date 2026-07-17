"""
transcribe.py — Basic WhisperX transcription (no diarization, no alignment).

Usage:
    python transcribe.py <audio_file>

Example:
    python transcribe.py test.mp3

Requires:
    - FFmpeg installed on your system  (brew install ffmpeg)
    - Packages from requirements.txt   (pip install -r requirements.txt)
"""

import sys
import warnings

# Suppress the torchcodec/FFmpeg warning from pyannote at import time
warnings.filterwarnings("ignore", message="torchcodec is not installed correctly")

import whisperx


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file>")
        sys.exit(1)

    audio_path = sys.argv[1]

    # ── Model config ────────────────────────────────────────────────────────
    MODEL_SIZE = "small"       # tiny | base | small | medium | large-v2 | large-v3
    DEVICE     = "cpu"         # "cuda" if you have an NVIDIA GPU
    COMPUTE    = "float32"     # float16 requires CUDA; keep float32 on CPU / Apple Silicon
    BATCH_SIZE = 16            # reduce if you hit memory limits

    # ── Load model ──────────────────────────────────────────────────────────
    print(f"Loading WhisperX '{MODEL_SIZE}' model on {DEVICE} …", flush=True)
    model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE)

    # ── Transcribe ──────────────────────────────────────────────────────────
    print(f"Transcribing: {audio_path}\n", flush=True)
    result = model.transcribe(audio_path, batch_size=BATCH_SIZE)

    # ── Print readable output ────────────────────────────────────────────────
    language = result.get("language", "unknown")
    segments  = result.get("segments", [])

    print(f"Detected language : {language}")
    print(f"Segments found    : {len(segments)}")
    print("-" * 60)

    for seg in segments:
        start = seg["start"]
        end   = seg["end"]
        text  = seg["text"].strip()
        print(f"[{start:7.2f}s → {end:7.2f}s]  {text}")

    print("-" * 60)
    full_text = " ".join(s["text"].strip() for s in segments)
    print("\nFull transcript:\n")
    print(full_text)


if __name__ == "__main__":
    main()
