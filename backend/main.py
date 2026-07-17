import os
from fastapi import FastAPI
from routers import recordings, projects, tags

app = FastAPI(title="UXR Platform API")

# Ensure uploads directory exists on startup
os.makedirs("uploads", exist_ok=True)

app.include_router(recordings.router)
app.include_router(projects.router)
app.include_router(tags.router)

@app.get("/health")
async def health_check():
    """Health check — used by Docker Compose and load balancers."""
    return {"status": "ok"}

