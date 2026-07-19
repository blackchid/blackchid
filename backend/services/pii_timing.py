"""
services/pii_timing.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maps a PII detection's *character* offset range (as produced by Presidio)
back to a precise *audio time* range, using WhisperX word-level timestamps.

This module is **pure** (no DB, no I/O) so it can be unit-tested without
any infrastructure. The only inputs are:

  segment_text      – the raw text string of the transcript segment
  word_timestamps   – list of dicts as stored in TranscriptSegment.word_timestamps
                      each: {"word": str, "start": float, "end": float, ...}
  char_start        – Presidio result.start  (inclusive)
  char_end          – Presidio result.end    (exclusive)

Algorithm
---------
1. Walk through word_timestamps, reconstructing the character positions of
   each word inside segment_text by fuzzy-matching (strip leading spaces).
2. Collect every word whose character span *overlaps* [char_start, char_end).
3. Return (min_start, max_end) of those overlapping words as seconds.

Fallback
--------
If word_timestamps is None / empty, or no word overlaps (e.g. alignment
model not available for this language), we return the segment-level times
passed in as fallback_start / fallback_end.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class WordSpan:
    """One WhisperX aligned word with its character position in the segment."""
    word: str
    char_start: int
    char_end: int      # exclusive
    time_start: float
    time_end: float


def build_word_spans(segment_text: str, word_timestamps: list[dict]) -> list[WordSpan]:
    """
    Walk word_timestamps in order, locating each word inside segment_text by
    scanning forward from the last found position.

    WhisperX words often have a leading space (e.g. " John").  We strip
    punctuation and search case-insensitively so minor mismatches don't
    break the mapping.

    Returns a list of WordSpan objects in order.
    """
    spans: list[WordSpan] = []
    cursor = 0  # current search position in segment_text

    for entry in word_timestamps:
        raw_word: str = entry.get("word", "")
        t_start: float = entry.get("start", 0.0)
        t_end: float = entry.get("end", t_start)

        # Normalise: strip surrounding whitespace for the search needle
        needle = raw_word.strip()
        if not needle:
            continue

        # Search for this word starting from cursor position
        idx = segment_text.lower().find(needle.lower(), cursor)
        if idx == -1:
            # Fallback: search from the very beginning (handles repeated words
            # that appear earlier in the segment text — take next occurrence)
            idx = segment_text.lower().find(needle.lower(), 0)
        if idx == -1:
            # Word not found at all — skip (alignment artifact / punctuation)
            continue

        word_end = idx + len(needle)
        spans.append(WordSpan(
            word=needle,
            char_start=idx,
            char_end=word_end,
            time_start=t_start,
            time_end=t_end,
        ))
        cursor = word_end  # advance past this word

    return spans


def char_offset_to_time(
    segment_text: str,
    word_timestamps: Optional[list[dict]],
    char_start: int,
    char_end: int,
    fallback_start: float = 0.0,
    fallback_end: float = 0.0,
) -> tuple[float, float]:
    """
    Map a character offset range [char_start, char_end) within segment_text
    to an audio time range in seconds using WhisperX word-level timestamps.

    Parameters
    ----------
    segment_text : str
        The full text of the TranscriptSegment.
    word_timestamps : list[dict] | None
        The word_timestamps JSONB field from TranscriptSegment.
        Each dict: {"word": str, "start": float, "end": float, "score": float}
    char_start : int
        Inclusive start character offset (Presidio result.start).
    char_end : int
        Exclusive end character offset (Presidio result.end).
    fallback_start : float
        Segment-level start_time to use when word-level data is unavailable.
    fallback_end : float
        Segment-level end_time to use when word-level data is unavailable.

    Returns
    -------
    (time_start, time_end) in seconds, where time_start <= time_end.
    """
    if not word_timestamps:
        return fallback_start, fallback_end

    spans = build_word_spans(segment_text, word_timestamps)
    if not spans:
        return fallback_start, fallback_end

    # Find all words whose character span overlaps [char_start, char_end)
    overlapping = [
        s for s in spans
        if s.char_start < char_end and s.char_end > char_start
    ]

    if not overlapping:
        return fallback_start, fallback_end

    return (
        min(s.time_start for s in overlapping),
        max(s.time_end for s in overlapping),
    )
