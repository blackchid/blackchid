# Local AI Setup for Tag Suggestions

To support the "Suggest Tags" feature, the Blackchid backend connects to a local instance of Ollama running the `llama3` model.

## Prerequisites

1. **Install Ollama**
   Download and install Ollama from [ollama.com](https://ollama.com).
   - On macOS/Windows: Run the installer.
   - On Linux: `curl -fsSL https://ollama.com/install.sh | sh`

2. **Pull the Llama 3 Model**
   Once Ollama is installed and running in the background, open your terminal and run:
   ```bash
   ollama pull llama3
   ```
   This will download the `llama3` model weights (approx. 4.7GB).

## Running the Platform

By default, the backend expects the Ollama API to be available at `http://127.0.0.1:11434`. 
If you are running Ollama on a different machine or port, set the environment variable:

```bash
export OLLAMA_BASE_URL="http://your-ollama-host:11434"
```

## Testing the Setup
You can verify Ollama is running and has `llama3` downloaded by pinging it directly:

```bash
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "Hello!"
}'
```
