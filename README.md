# project-root

## What this does

Transcribes any audio file into a structured JSON file with:
- **Word-accurate text** — via OpenAI Whisper (through WhisperX)
- **Word-level timestamps** — via forced alignment with wav2vec2
- **Speaker labels** — via Pyannote speaker diarization

---

## Prerequisites

### 1. Python 3.11
WhisperX is not compatible with Python 3.12+.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. FFmpeg
Required to decode audio files (MP3, M4A, WAV, FLAC, etc.).

```bash
brew install ffmpeg        # macOS
sudo apt install ffmpeg    # Ubuntu/Debian
```

### 3. HuggingFace Account + Token

Speaker diarization uses Pyannote's model, which is hosted on HuggingFace.

**Step-by-step:**
1. Create a free account at [huggingface.co](https://huggingface.co)
2. Go to **[Settings → Access Tokens](https://huggingface.co/settings/tokens)** → click **New token**
3. Set type to **Read** (write access is not needed) → Create
4. Visit **[pyannote/speaker-diarization-community-1](https://huggingface.co/pyannote/speaker-diarization-community-1)** and click **Agree** to accept the model's user conditions (one-time, instant)
5. Export your token in your shell:

```bash
export HF_TOKEN=hf_your_token_here
```

> The first run downloads ~35 MB of model weights and caches them locally.
> Every subsequent run uses the local cache — no internet needed.

---

## Usage

```bash
# Basic — output written to shape.json by default
python transcribe.py shape.mp3

# Custom output path
python transcribe.py interview.wav transcript.json

# Inline token (one-off)
HF_TOKEN=hf_... python transcribe.py podcast.m4a
```

**Supported formats:** MP3, WAV, M4A, FLAC, OGG, OPUS, and any format FFmpeg can decode.

---

## Output Format

The script prints a summary table to the terminal and saves a JSON file:

```json
{
  "audio_file": "/absolute/path/to/shape.mp3",
  "language": "en",
  "segments": [
    {
      "start_time": 2.81,
      "end_time": 24.31,
      "speaker_label": "SPEAKER_00",
      "text": "I found a love for me, darling just dive right in."
    },
    {
      "start_time": 25.46,
      "end_time": 46.10,
      "speaker_label": "SPEAKER_00",
      "text": "I never knew you were the someone waiting for me."
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `audio_file` | string | Absolute path to the input file |
| `language` | string | ISO 639-1 language code detected by Whisper |
| `segments[].start_time` | float | Segment start in seconds (3 decimal places) |
| `segments[].end_time` | float | Segment end in seconds (3 decimal places) |
| `segments[].speaker_label` | string | `SPEAKER_00`, `SPEAKER_01`, … or `UNKNOWN` |
| `segments[].text` | string | Transcribed text for this segment |

---

## Error Messages

| Error | Meaning | Fix |
|---|---|---|
| `ffmpeg is not installed` | FFmpeg missing | `brew install ffmpeg` |
| `File not found` | Audio path wrong | Check the file path |
| `Cannot read audio file` | Corrupt or unsupported format | Try converting with FFmpeg first |
| `HF_TOKEN environment variable is not set` | Token missing | `export HF_TOKEN=hf_...` |
| `Access denied to the Pyannote model` | Model terms not accepted | Visit the model page and click Agree |
| `HuggingFace authentication failed` | Token invalid/expired | Create a new token |

---

## Model Config

Edit these constants at the top of `main()` in `transcribe.py`:

```python
MODEL_SIZE = "small"    # tiny | base | small | medium | large-v2 | large-v3
DEVICE     = "cpu"      # "cuda" if you have an NVIDIA GPU
COMPUTE    = "float32"  # float16 needs CUDA
BATCH_SIZE = 16         # lower if you hit memory limits
```

**Performance note:** Diarization on CPU is slow (~2–5× real-time for a typical file).
If you have an Apple Silicon Mac, `DEVICE = "mps"` can speed up transcription (not diarization).

---

## Requirements

```
torch==2.8.0
torchaudio==2.8.0
whisperx==3.8.6
```
