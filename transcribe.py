"""
transcribe.py — WhisperX transcription + alignment + speaker diarization.

Pipeline:
  1. Transcribe  (Whisper)          → segments with rough timestamps
  2. Align       (wav2vec2)         → word-level timestamps
  3. Diarize     (Pyannote)         → who spoke when
  4. Combine                        → start | end | speaker | text per segment

Usage:
    HF_TOKEN=hf_xxx python transcribe.py <audio_file>

    Or set it once in your shell:
        export HF_TOKEN=hf_xxx
        python transcribe.py test.mp3

Get your token: https://huggingface.co/settings/tokens
(Read scope is enough. No gated model approval needed for the community model.)
"""

import os
import sys
import warnings

# Suppress the benign torchcodec/pyannote warning on import
warnings.filterwarnings("ignore", message="torchcodec is not installed correctly")
warnings.filterwarnings("ignore", category=UserWarning, module="pyannote")

import whisperx
from whisperx.diarize import DiarizationPipeline


def print_separator(char: str = "─", width: int = 64) -> None:
    print(char * width)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: HF_TOKEN=hf_xxx python transcribe.py <audio_file>")
        sys.exit(1)

    audio_path = sys.argv[1]

    # ── Read HuggingFace token from environment ───────────────────────────────
    # We never hard-code secrets in source code.
    # Set it in your shell:  export HF_TOKEN=hf_...
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        print("ERROR: HF_TOKEN environment variable is not set.")
        print("  Get a token at: https://huggingface.co/settings/tokens")
        print("  Then run: export HF_TOKEN=hf_xxx")
        sys.exit(1)

    # ── Config ────────────────────────────────────────────────────────────────
    MODEL_SIZE = "small"    # tiny | base | small | medium | large-v2 | large-v3
    DEVICE     = "cpu"      # "cuda" if you have an NVIDIA GPU
    COMPUTE    = "float32"  # float16 needs CUDA; use float32 on CPU / Apple Silicon
    BATCH_SIZE = 16         # lower if you hit memory limits

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1 — Transcribe
    # ─────────────────────────────────────────────────────────────────────────
    # Whisper turns audio into text. At this stage we only know which
    # SENTENCE was said and roughly when — not which word, and not who said it.
    print(f"\n[1/4] Loading WhisperX '{MODEL_SIZE}' model …", flush=True)
    model = whisperx.load_model(MODEL_SIZE, DEVICE, compute_type=COMPUTE)

    print(f"[2/4] Transcribing: {audio_path} …", flush=True)
    result = model.transcribe(audio_path, batch_size=BATCH_SIZE)

    language = result.get("language", "unknown")
    segments  = result.get("segments", [])
    print(f"      → language={language}, segments={len(segments)}", flush=True)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2 — Forced Alignment (word-level timestamps)
    # ─────────────────────────────────────────────────────────────────────────
    # wav2vec2 reads the raw audio frame-by-frame and matches each phoneme
    # to the text Whisper produced, giving us millisecond-accurate word times.
    print(f"[3/4] Loading alignment model for '{language}' …", flush=True)
    align_model, align_metadata = whisperx.load_align_model(
        language_code=language,
        device=DEVICE,
    )

    print(f"      Aligning …", flush=True)
    aligned = whisperx.align(
        segments,
        align_model,
        align_metadata,
        audio_path,
        DEVICE,
        return_char_alignments=False,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3 — Diarization ("who spoke when")
    # ─────────────────────────────────────────────────────────────────────────
    # Pyannote's speaker diarization model listens to the audio and returns
    # time ranges labelled SPEAKER_00, SPEAKER_01, etc.
    # It does NOT know who the person IS — just that these time ranges belong
    # to the same distinct voice.
    #
    # Model used: pyannote/speaker-diarization-community-1
    # This is a community model that only requires a HF token — no gated
    # model approval needed (unlike pyannote/speaker-diarization-3.x).
    print(f"[4/4] Running speaker diarization …", flush=True)
    diarize_model = DiarizationPipeline(
        token=hf_token,
        device=DEVICE,
    )

    diarize_segments = diarize_model(
        audio_path,
        # Optionally hint at speaker count for better accuracy:
        # min_speakers=1,
        # max_speakers=5,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4 — Combine: assign a speaker label to each segment (and word)
    # ─────────────────────────────────────────────────────────────────────────
    # assign_word_speakers() overlays the diarization time-ranges onto the
    # aligned segments using an interval tree (O(log n)).
    # For each segment it picks whichever speaker overlaps the most time.
    # Each word also gets a speaker label for maximum granularity.
    final = whisperx.assign_word_speakers(diarize_segments, aligned)
    final_segments = final.get("segments", [])

    # ─────────────────────────────────────────────────────────────────────────
    # OUTPUT — clean, readable table
    # ─────────────────────────────────────────────────────────────────────────
    print(f"\n{'═' * 70}")
    print(f"  RESULT — Transcription + Alignment + Diarization")
    print(f"  Language: {language}  |  Segments: {len(final_segments)}")
    print(f"{'═' * 70}")
    print(f"  {'START':>8}   {'END':>8}   {'SPEAKER':<14}  TEXT")
    print_separator("─", 70)

    for seg in final_segments:
        start   = seg.get("start", 0)
        end     = seg.get("end",   0)
        speaker = seg.get("speaker", "UNKNOWN")
        text    = seg.get("text", "").strip()
        print(f"  {start:7.2f}s   {end:7.2f}s   {speaker:<14}  {text}")

    print_separator("═", 70)

    # ── Word-level detail (optional deeper view) ─────────────────────────────
    print(f"\n  WORD-LEVEL DETAIL")
    print_separator("─", 70)
    print(f"  {'WORD':<22} {'START':>9}  {'END':>9}  {'SCORE':>6}  {'SPEAKER'}")
    print_separator("─", 70)

    for seg in final_segments:
        for w in seg.get("words", []):
            word    = w.get("word",    "?")
            start   = w.get("start",   None)
            end     = w.get("end",     None)
            score   = w.get("score",   None)
            speaker = w.get("speaker", "—")

            ts_s = f"{start:.3f}s" if start is not None else "    —   "
            ts_e = f"{end:.3f}s"   if end   is not None else "    —   "
            sc   = f"{score:.2f}"  if score is not None else "  —  "

            print(f"  {word:<22} {ts_s:>9}  {ts_e:>9}  {sc:>6}  {speaker}")

    print_separator("═", 70)
    print("  Done.\n")


if __name__ == "__main__":
    main()
