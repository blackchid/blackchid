"""
transcribe.py — WhisperX transcription + alignment + speaker diarization.

Pipeline:
  1. Transcribe  (Whisper)     → segments with rough timestamps
  2. Align       (wav2vec2)    → word-level timestamps
  3. Diarize     (Pyannote)    → who spoke when
  4. Combine + save            → JSON file with start_time/end_time/speaker/text

Usage:
    python transcribe.py <audio_file> [output.json]

    HF_TOKEN must be set in your environment:
        export HF_TOKEN=hf_...
        python transcribe.py interview.mp3

    Or inline:
        HF_TOKEN=hf_... python transcribe.py interview.mp3

Prerequisites:
    - FFmpeg installed:  brew install ffmpeg
    - HuggingFace token: https://huggingface.co/settings/tokens  (Read scope)
    - Accept model terms: https://hf.co/pyannote/speaker-diarization-community-1
"""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import warnings

warnings.filterwarnings("ignore", message="torchcodec is not installed correctly")
warnings.filterwarnings("ignore", category=UserWarning, module="pyannote")


# ── Error helpers (no stack traces for known user errors) ─────────────────────

def die(message: str, hint: str = "") -> None:
    """Print a clean error and exit with code 1."""
    print(f"\n❌  {message}", file=sys.stderr)
    if hint:
        print(f"    {hint}", file=sys.stderr)
    print()
    sys.exit(1)


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        die(
            "ffmpeg is not installed or not on your PATH.",
            "Fix: brew install ffmpeg",
        )


def check_audio_file(path: str) -> None:
    p = pathlib.Path(path)
    if not p.exists():
        die(f"File not found: {path}")
    if not p.is_file():
        die(f"Not a file: {path}")
    # Quick probe with ffmpeg to catch corrupt / unsupported files
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"],
        stderr=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
    )
    ffmpeg_stderr = result.stderr.decode(errors="replace").strip()
    # ffmpeg exits non-zero for truly unreadable files AND for those it
    # successfully converts (exit 1 is normal when output is /dev/null).
    # We check for hard error keywords instead of exit code.
    bad_keywords = ("Invalid data", "No such file", "moov atom not found",
                    "not supported", "Invalid argument", "corrupt")
    if any(kw.lower() in ffmpeg_stderr.lower() for kw in bad_keywords):
        die(
            f"Cannot read audio file: {path}",
            f"FFmpeg said: {ffmpeg_stderr.splitlines()[0] if ffmpeg_stderr else 'unknown error'}",
        )


def check_hf_token() -> str:
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        die(
            "HF_TOKEN environment variable is not set.",
            "Get a token at: https://huggingface.co/settings/tokens  (Read scope)\n"
            "    Then: export HF_TOKEN=hf_...",
        )
    return token


# ── Main pipeline ─────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    audio_path = sys.argv[1]
    out_path   = sys.argv[2] if len(sys.argv) > 2 else None

    # Default output filename: same stem as input, .json extension
    if out_path is None:
        out_path = str(pathlib.Path(audio_path).with_suffix(".json"))

    # ── Pre-flight checks (fast, before loading any heavy models) ────────────
    check_ffmpeg()
    check_audio_file(audio_path)
    hf_token = check_hf_token()

    # ── Lazy import after checks (avoids long import time on bad input) ───────
    import whisperx
    from whisperx.diarize import DiarizationPipeline

    MODEL_SIZE = "small"    # tiny | base | small | medium | large-v2 | large-v3
    DEVICE     = "cpu"      # "cuda" if you have an NVIDIA GPU
    COMPUTE    = "float32"  # float16 needs CUDA; use float32 on CPU / Apple Silicon
    BATCH_SIZE = 16         # lower if you hit memory limits

    # ── STEP 1: Transcribe ────────────────────────────────────────────────────
    # Whisper turns audio → text with rough segment-level timestamps.
    print(f"\n[1/4] Loading WhisperX '{MODEL_SIZE}' model …", flush=True)
    model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE)

    print(f"[2/4] Transcribing: {audio_path} …", flush=True)
    result = model.transcribe(audio_path, batch_size=BATCH_SIZE)

    language = result.get("language", "unknown")
    segments  = result.get("segments", [])
    print(f"      ✓ language={language}, segments={len(segments)}", flush=True)

    # ── STEP 2: Forced Alignment (word-level timestamps) ─────────────────────
    # wav2vec2 pins every word to its exact millisecond in the audio.
    print(f"[3/4] Aligning (word-level timestamps) …", flush=True)
    try:
        align_model, align_metadata = whisperx.load_align_model(
            language_code=language, device=DEVICE
        )
        aligned = whisperx.align(
            segments, align_model, align_metadata, audio_path, DEVICE,
            return_char_alignments=False,
        )
    except ValueError as exc:
        # No alignment model exists for this language — fall back gracefully
        print(f"      ⚠  No alignment model for '{language}': {exc}", flush=True)
        print(f"         Continuing without word-level alignment.", flush=True)
        aligned = result  # use raw transcription segments

    # ── STEP 3: Diarization ("who spoke when") ───────────────────────────────
    # Pyannote labels time ranges SPEAKER_00, SPEAKER_01, etc.
    print(f"[4/4] Running speaker diarization (this is slow on CPU) …", flush=True)
    try:
        diarize_model = DiarizationPipeline(token=hf_token, device=DEVICE)
        diarize_segments = diarize_model(audio_path)
        final = whisperx.assign_word_speakers(diarize_segments, aligned)
    except Exception as exc:
        err = str(exc)
        # Gated repo: token is valid but model terms not accepted
        if "GatedRepoError" in type(exc).__name__ or "gated" in err.lower() or "403" in err:
            die(
                "Access denied to the Pyannote diarization model.",
                "You need to accept the model's user conditions:\n"
                "    → https://hf.co/pyannote/speaker-diarization-community-1\n"
                "    Log in, click 'Agree', then re-run.",
            )
        # Invalid / expired token
        if "401" in err or "credentials" in err.lower():
            die(
                "HuggingFace authentication failed — your token may be invalid or expired.",
                "Create a new token at: https://huggingface.co/settings/tokens",
            )
        # Any other unexpected error
        die(f"Diarization failed: {exc}")

    final_segments = final.get("segments", [])

    # ── STEP 4: Build JSON output ─────────────────────────────────────────────
    # Each segment: start_time, end_time, speaker_label, text
    output = {
        "audio_file": str(pathlib.Path(audio_path).resolve()),
        "language":   language,
        "segments": [
            {
                "start_time":    round(seg.get("start", 0), 3),
                "end_time":      round(seg.get("end",   0), 3),
                "speaker_label": seg.get("speaker", "UNKNOWN"),
                "text":          seg.get("text", "").strip(),
            }
            for seg in final_segments
        ],
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # ── Print summary to terminal ─────────────────────────────────────────────
    width = 70
    print(f"\n{'═' * width}")
    print(f"  {'START':>8}   {'END':>8}   {'SPEAKER':<14}  TEXT")
    print(f"{'─' * width}")
    for seg in output["segments"]:
        print(
            f"  {seg['start_time']:7.2f}s"
            f"   {seg['end_time']:7.2f}s"
            f"   {seg['speaker_label']:<14}"
            f"  {seg['text']}"
        )
    print(f"{'═' * width}")
    print(f"\n  ✓ Saved → {out_path}")
    print(f"  ✓ {len(output['segments'])} segments  |  language: {language}\n")


if __name__ == "__main__":
    main()
