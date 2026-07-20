"""
services/audio_redaction.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FFmpeg-based audio redaction for audio-only files (MP3, WAV, M4A, FLAC…).

Key design decisions
--------------------
1. AUDIO-ONLY FIRST — this is the product's core differentiator.
   We deliberately avoid -vf / -af video filter chains that break on
   files without a video track.  The entire pipeline uses the audio
   filter graph exclusively.

2. Single FFmpeg pass — all mute spans are compiled into one
   `volume=enable='between(t,…,…)':volume=0` filter chain, so the file
   is only decoded and re-encoded once regardless of how many PII spans exist.

3. Codec-aware re-encoding — we detect the input codec and pick the
   best lossless-then-lossy fallback:
     MP3  → libmp3lame (same quality)
     WAV  → pcm_s16le  (lossless)
     FLAC → flac        (lossless)
     M4A  → aac        (same container)
     OGG  → libvorbis
     WEBM → libvorbis
     default → copy-compatible fallback via libmp3lame

4. Silence rather than beep — we use volume=0 so the redacted portion
   is silent (no jarring tones).  A future caller may request a beep
   tone instead; this can be added via `aeval=0` replaced with
   `sine=frequency=1000` and merged via `amerge`.

5. Atomic write — output goes to a temp path first; only on FFmpeg
   success is it renamed to the final path.

6. Pure function — the service is callable in tests without FastAPI.

Usage
-----
    from services.audio_redaction import redact_audio

    output_path = redact_audio(
        input_path  = "uploads/my-interview.mp3",
        time_ranges = [(10.5, 12.3), (47.1, 48.8)],   # seconds
        output_path = "uploads/my-interview_redacted.mp3",   # optional
    )
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Sequence

logger = logging.getLogger(__name__)


# ── Codec / container mapping ─────────────────────────────────────────────────

_CODEC_MAP: dict[str, tuple[str, str]] = {
    # ext  → (ffmpeg_codec, output_ext)
    ".mp3":  ("libmp3lame", ".mp3"),
    ".wav":  ("pcm_s16le",  ".wav"),
    ".flac": ("flac",       ".flac"),
    ".m4a":  ("aac",        ".m4a"),
    ".ogg":  ("libvorbis",  ".ogg"),
    ".webm": ("libvorbis",  ".webm"),
}


def _output_codec(input_path: str) -> tuple[str, str]:
    """Return (ffmpeg_codec, output_extension) for input_path's format."""
    ext = Path(input_path).suffix.lower()
    return _CODEC_MAP.get(ext, ("libmp3lame", ".mp3"))


# ── Range utilities ──────────────────────────────────────────────────────────

def _merge_ranges(ranges: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Merge overlapping or adjacent (start, end) tuples."""
    if not ranges:
        return []
    sorted_ranges = sorted(ranges, key=lambda x: x[0])
    merged = [sorted_ranges[0]]
    for start, end in sorted_ranges[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


# ── Core redaction function ───────────────────────────────────────────────────

def redact_audio(
    input_path: str,
    time_ranges: Sequence[tuple[float, float]],
    output_path: str | None = None,
    quality_arg: str = "4",   # libmp3lame VBR quality (2=best, 9=worst); ignored for lossless
) -> str:
    """
    Mute specific time ranges in an audio-only file using FFmpeg.

    Parameters
    ----------
    input_path : str
        Absolute or relative path to the source audio file.
    time_ranges : list of (start_sec, end_sec) tuples
        The spans to silence.  Overlapping ranges are handled correctly
        because the filter applies volume=0 anywhere the condition is true.
    output_path : str | None
        Where to write the redacted file.  Defaults to
        ``<input_stem>_redacted<ext>`` in the same directory.
    quality_arg : str
        VBR quality passed to libmp3lame (``-q:a``).  Ignored for PCM/FLAC.

    Returns
    -------
    str
        Path to the redacted audio file.

    Raises
    ------
    FileNotFoundError
        If ``input_path`` does not exist.
    RuntimeError
        If FFmpeg exits with a non-zero return code.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input audio not found: {input_path}")

    if not time_ranges:
        # Nothing to redact — return the original path unchanged
        logger.info("redact_audio: no time ranges supplied, returning original")
        return input_path

    codec, out_ext = _output_codec(input_path)

    if output_path is None:
        stem = Path(input_path).stem
        out_dir = Path(input_path).parent
        output_path = str(out_dir / f"{stem}_redacted{out_ext}")

    # ── Build the FFmpeg audio filter expression ──────────────────────────────
    #
    # For each span (s, e) we inject:
    #   volume=enable='between(t,s,e)':volume=0
    #
    # Chained together with commas, FFmpeg applies them all in one pass.
    # `between(t, s, e)` is true when s ≤ t ≤ e (inclusive both ends).
    #
    # Example for two ranges [(10.5, 12.3), (47.0, 48.0)]:
    #   volume=enable='between(t,10.5,12.3)':volume=0,
    #   volume=enable='between(t,47.0,48.0)':volume=0
    #
    filter_parts = [
        f"volume=enable='between(t,{s:.6f},{e:.6f})':volume=0"
        for s, e in time_ranges
    ]
    af_filter = ",".join(filter_parts)

    # ── FFmpeg command ────────────────────────────────────────────────────────
    #
    # -vn          → no video output (safe for audio-only; no-op for video input)
    # -af          → audio filter chain
    # -c:a         → audio codec for output
    # -q:a         → VBR quality (only meaningful for lossy codecs)
    # -map 0:a     → map ONLY audio streams from input (critical for audio-only
    #               files: avoids "Stream specifier 0:v not found" errors that
    #               break competitors' implementations when no video track exists)
    #
    # We write to a temp file first so a failed run never leaves a corrupt
    # partial output at the target path.
    #
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=out_ext)
    os.close(tmp_fd)

    cmd = [
        "ffmpeg",
        "-y",                    # overwrite temp file without prompt
        "-i", input_path,
        "-map", "0:a",           # ← audio-only safety: map only audio streams
        "-vn",                   # ← belt-and-suspenders: no video output
        "-af", af_filter,
        "-c:a", codec,
    ]

    # Only add quality flag for lossy codecs
    if codec in ("libmp3lame", "aac", "libvorbis"):
        cmd += ["-q:a", quality_arg]

    cmd.append(tmp_path)

    logger.info("redact_audio: running %s", " ".join(cmd))

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        os.unlink(tmp_path)
        raise RuntimeError(
            f"FFmpeg failed (exit {result.returncode}):\n"
            f"STDOUT: {result.stdout}\n"
            f"STDERR: {result.stderr}"
        )

    # Atomic rename
    shutil.move(tmp_path, output_path)
    logger.info("redact_audio: wrote redacted file to %s", output_path)
    return output_path
