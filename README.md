# project-root

## Environment Setup

This project uses [WhisperX](https://github.com/m-bain/whisperX) for GPU-accelerated transcription with word-level timestamps, backed by PyTorch and torchaudio. Speaker diarization is powered by [Pyannote.audio](https://github.com/pyannote/pyannote-audio), which includes **gated models** hosted on Hugging Face that require explicit access approval before use. To unlock diarization, you must: (1) create a free account at [huggingface.co](https://huggingface.co), (2) generate a personal access token under **Settings → Access Tokens** (read scope is sufficient), (3) visit the model card for [`pyannote/speaker-diarization-3.1`](https://huggingface.co/pyannote/speaker-diarization-3.1) and accept the user conditions, and (4) do the same for [`pyannote/segmentation-3.0`](https://huggingface.co/pyannote/segmentation-3.0). Once approved (usually instant), pass your token via the `HF_TOKEN` environment variable or the `use_auth_token` parameter when loading the pipeline. Without this token the diarization stage will raise a `GatedRepoError` at runtime.

## Quick Start

```bash
# Create and activate the virtual environment (Python 3.11 required)
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Verify installation
pip list
```

## Requirements

- Python 3.11
- A CUDA-capable GPU is recommended for real-time-factor performance (CPU works but is slow)
- Hugging Face account + access token (see above)
