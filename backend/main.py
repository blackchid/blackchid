import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import recordings, projects, tags, auth, insights, redaction

app = FastAPI(title="UXR Platform API")

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the Next.js dev server (and any localhost port) to call the API.
# In production, replace with your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists on startup
os.makedirs("uploads", exist_ok=True)

app.include_router(recordings.router)
app.include_router(projects.router)
app.include_router(tags.router)
app.include_router(auth.router)
app.include_router(insights.router)
app.include_router(redaction.router)


@app.get("/health")
async def health_check():
    """Health check — used by Docker Compose and load balancers."""
    return {"status": "ok"}

