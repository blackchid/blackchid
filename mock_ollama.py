from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()

@app.post("/api/generate")
async def generate(request: Request):
    data = await request.json()
    print("Ollama Mock received prompt:", data.get("prompt"))
    return {
        "model": "llama3",
        "created_at": "2026-07-20T10:00:00Z",
        "response": '["usability issue", "pricing", "feature request"]',
        "done": True
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=11434)
