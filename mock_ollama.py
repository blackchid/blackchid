from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()

@app.post("/api/generate")
async def generate(request: Request):
    data = await request.json()
    prompt = data.get("prompt", "")
    
    # If the prompt contains the contextual markers we added in our backend logic
    if "Context:" in prompt and "--> [TARGET]" in prompt:
        print("Mock LLM detected conversational context!")
        # The LLM knows the "earlier question" was about pricing, and the current text is about dashboard UI.
        return {
            "model": "llama3",
            "created_at": "2026-07-20T10:00:00Z",
            "response": '["pricing model", "high cost", "dashboard ui", "cluttered"]',
            "done": True
        }
    else:
        print("Mock LLM detected NO context (single segment)!")
        # The LLM only sees "The dashboard mostly. Oh, and about your earlier question, it's way too expensive for us."
        # It doesn't know what the earlier question was, so it gives generic tags.
        return {
            "model": "llama3",
            "created_at": "2026-07-20T10:00:00Z",
            "response": '["dashboard", "expensive", "unspecified complaint"]',
            "done": True
        }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=11434)
