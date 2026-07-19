"""
test_pii_timing.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tests for services/pii_timing.py — the char-offset → audio-time mapper.

Run with:
    cd backend && python test_pii_timing.py

These tests use *synthetic* WhisperX word-level data, so no audio file or
GPU is required.  The test sentence is the same fake-PII sentence used in
test_pii.py:

    "My name is John Doe, email me at john.doe@example.com or call 555-123-4567."

We manually assign plausible word-level timestamps (as if WhisperX had
aligned a real recording), then verify that running Presidio on the text
and feeding the result offsets into char_offset_to_time() gives back the
expected audio time windows.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from presidio_analyzer import AnalyzerEngine
from services.pii_timing import char_offset_to_time, build_word_spans

# ── Shared test data ──────────────────────────────────────────────────────────

TEXT = "My name is John Doe, email me at john.doe@example.com or call 555-123-4567."

# Plausible word-level timestamps (simulating WhisperX alignment output).
# Each word's time is set so PII items fall at recognisable, easy-to-check
# positions in the "audio".
WORD_TIMESTAMPS = [
    {"word": "My",                     "start": 0.00, "end": 0.20, "score": 0.99},
    {"word": "name",                   "start": 0.25, "end": 0.50, "score": 0.99},
    {"word": "is",                     "start": 0.55, "end": 0.65, "score": 0.99},
    {"word": "John",                   "start": 0.70, "end": 1.00, "score": 0.97},
    {"word": "Doe,",                   "start": 1.05, "end": 1.35, "score": 0.96},
    {"word": "email",                  "start": 1.50, "end": 1.75, "score": 0.99},
    {"word": "me",                     "start": 1.80, "end": 1.90, "score": 0.99},
    {"word": "at",                     "start": 1.95, "end": 2.05, "score": 0.99},
    {"word": "john.doe@example.com",   "start": 2.10, "end": 2.80, "score": 0.95},
    {"word": "or",                     "start": 2.90, "end": 3.00, "score": 0.99},
    {"word": "call",                   "start": 3.05, "end": 3.25, "score": 0.99},
    {"word": "555-123-4567.",          "start": 3.30, "end": 4.00, "score": 0.93},
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def approx(a: float, b: float, tol: float = 0.05) -> bool:
    return abs(a - b) <= tol


def run_presidio(text: str) -> list[dict]:
    """Return Presidio detections as plain dicts for easy inspection."""
    analyzer = AnalyzerEngine()
    results = analyzer.analyze(text=text, language="en")
    return [
        {
            "entity_type": r.entity_type,
            "start": r.start,
            "end": r.end,
            "score": r.score,
            "matched_text": text[r.start:r.end],
        }
        for r in results
    ]


# ── Tests ─────────────────────────────────────────────────────────────────────

PASS = 0
FAIL = 0

def check(label: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        print(f"  ✅  {label}")
        PASS += 1
    else:
        print(f"  ❌  {label}{' — ' + detail if detail else ''}")
        FAIL += 1


def test_word_spans_built_correctly():
    """Verify build_word_spans reconstructs character positions correctly."""
    print("\n[1] build_word_spans()")
    spans = build_word_spans(TEXT, WORD_TIMESTAMPS)

    # "John" should be located at the right char offset
    john_spans = [s for s in spans if s.word.lower() == "john"]
    check("'John' span found", len(john_spans) == 1)
    if john_spans:
        idx = TEXT.index("John")
        check(
            f"'John' char_start == {idx}",
            john_spans[0].char_start == idx,
            f"got {john_spans[0].char_start}",
        )
        check(
            f"'John' char_end == {idx + 4}",
            john_spans[0].char_end == idx + 4,
            f"got {john_spans[0].char_end}",
        )

    # Email word
    email_spans = [s for s in spans if "example.com" in s.word.lower()]
    check("email word span found", len(email_spans) == 1)

    # Phone number word
    phone_spans = [s for s in spans if "555" in s.word]
    check("phone word span found", len(phone_spans) == 1)


def test_person_detection_timing():
    """
    PERSON entity 'John Doe' should map to the time window covering both words.
    Expected: start≈0.70  end≈1.35
    """
    print("\n[2] PERSON 'John Doe' → time window")
    detections = run_presidio(TEXT)
    person = next((d for d in detections if d["entity_type"] == "PERSON"), None)
    check("PERSON detected by Presidio", person is not None)
    if not person:
        return
    print(f"     Presidio offset: [{person['start']}:{person['end']}]  "
          f"matched='{person['matched_text']}'  score={person['score']:.2f}")

    t_start, t_end = char_offset_to_time(
        TEXT, WORD_TIMESTAMPS, person["start"], person["end"],
        fallback_start=0.0, fallback_end=4.0,
    )
    print(f"     Mapped time:     [{t_start:.2f}s → {t_end:.2f}s]")
    check("time_start ≈ 0.70s (start of 'John')", approx(t_start, 0.70), f"got {t_start:.3f}")
    check("time_end   ≈ 1.35s (end of 'Doe')",   approx(t_end,   1.35), f"got {t_end:.3f}")
    check("time window is non-zero",              t_end > t_start)


def test_email_detection_timing():
    """
    EMAIL_ADDRESS 'john.doe@example.com' should map to a single-word window.
    Expected: start≈2.10  end≈2.80
    """
    print("\n[3] EMAIL_ADDRESS → time window")
    detections = run_presidio(TEXT)
    email = next((d for d in detections if d["entity_type"] == "EMAIL_ADDRESS"), None)
    check("EMAIL_ADDRESS detected", email is not None)
    if not email:
        return
    print(f"     Presidio offset: [{email['start']}:{email['end']}]  "
          f"matched='{email['matched_text']}'  score={email['score']:.2f}")

    t_start, t_end = char_offset_to_time(
        TEXT, WORD_TIMESTAMPS, email["start"], email["end"],
        fallback_start=0.0, fallback_end=4.0,
    )
    print(f"     Mapped time:     [{t_start:.2f}s → {t_end:.2f}s]")
    check("time_start ≈ 2.10s", approx(t_start, 2.10), f"got {t_start:.3f}")
    check("time_end   ≈ 2.80s", approx(t_end,   2.80), f"got {t_end:.3f}")
    check("time window is non-zero", t_end > t_start)


def test_phone_detection_timing():
    """
    PHONE_NUMBER '555-123-4567' should map to its word window.
    Expected: start≈3.30  end≈4.00
    """
    print("\n[4] PHONE_NUMBER → time window")
    detections = run_presidio(TEXT)
    phone = next((d for d in detections if d["entity_type"] == "PHONE_NUMBER"), None)
    check("PHONE_NUMBER detected", phone is not None)
    if not phone:
        return
    print(f"     Presidio offset: [{phone['start']}:{phone['end']}]  "
          f"matched='{phone['matched_text']}'  score={phone['score']:.2f}")

    t_start, t_end = char_offset_to_time(
        TEXT, WORD_TIMESTAMPS, phone["start"], phone["end"],
        fallback_start=0.0, fallback_end=4.0,
    )
    print(f"     Mapped time:     [{t_start:.2f}s → {t_end:.2f}s]")
    check("time_start ≈ 3.30s", approx(t_start, 3.30), f"got {t_start:.3f}")
    check("time_end   ≈ 4.00s", approx(t_end,   4.00), f"got {t_end:.3f}")
    check("time window is non-zero", t_end > t_start)


def test_fallback_when_no_word_timestamps():
    """
    When word_timestamps is None, must return segment-level fallback times.
    """
    print("\n[5] Fallback when word_timestamps=None")
    t_start, t_end = char_offset_to_time(
        TEXT, None, 11, 19,  # offsets don't matter
        fallback_start=5.0, fallback_end=10.0,
    )
    check("returns fallback_start=5.0", t_start == 5.0, f"got {t_start}")
    check("returns fallback_end=10.0",  t_end   == 10.0, f"got {t_end}")


def test_fallback_when_word_timestamps_empty():
    """When word_timestamps is an empty list, also falls back."""
    print("\n[6] Fallback when word_timestamps=[]")
    t_start, t_end = char_offset_to_time(
        TEXT, [], 11, 19,
        fallback_start=1.0, fallback_end=2.0,
    )
    check("returns fallback_start=1.0", t_start == 1.0, f"got {t_start}")
    check("returns fallback_end=2.0",   t_end   == 2.0, f"got {t_end}")


def test_partial_overlap():
    """
    A char range that covers only part of a word should still return that word's
    full time span (i.e. we don't sub-word-split).
    """
    print("\n[7] Partial word overlap (char hits the middle of 'John')")
    # "John" occupies TEXT[11:15]; we ask for [12:14]
    idx = TEXT.index("John")
    t_start, t_end = char_offset_to_time(
        TEXT, WORD_TIMESTAMPS, idx + 1, idx + 3,  # inside 'John'
        fallback_start=0.0, fallback_end=4.0,
    )
    check("time_start ≈ 0.70s (word start)", approx(t_start, 0.70), f"got {t_start:.3f}")
    check("time_end   ≈ 1.00s (word end)",   approx(t_end,   1.00), f"got {t_end:.3f}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 62)
    print("PII char-offset → audio time mapper  (test_pii_timing.py)")
    print("=" * 62)
    print(f"\nTest sentence:\n  {TEXT!r}\n")

    test_word_spans_built_correctly()
    test_person_detection_timing()
    test_email_detection_timing()
    test_phone_detection_timing()
    test_fallback_when_no_word_timestamps()
    test_fallback_when_word_timestamps_empty()
    test_partial_overlap()

    print(f"\n{'=' * 62}")
    total = PASS + FAIL
    print(f"Results: {PASS}/{total} passed", "✅" if FAIL == 0 else "❌")
    if FAIL:
        print(f"         {FAIL} FAILED")
    print("=" * 62)
    sys.exit(0 if FAIL == 0 else 1)
