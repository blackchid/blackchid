import os
from pathlib import Path

# Load .env from the backend directory (safe no-op if file missing or python-dotenv not installed)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv optional; use shell env vars instead

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import recordings, projects, tags, auth, insights, redaction, pii_review, clips

app = FastAPI(title="UXR Platform API")

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the Next.js dev server (and any localhost port) to call the API.
# In production, replace with your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
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
app.include_router(pii_review.router)
app.include_router(clips.router)


@app.get("/health")
async def health_check():
    """Health check — used by Docker Compose and load balancers."""
    return {"status": "ok"}

