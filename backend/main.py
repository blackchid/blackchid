import os
from fastapi import FastAPI
from routers import recordings

app = FastAPI(title="UXR Platform API")

# Ensure uploads directory exists on startup
os.makedirs("/app/uploads", exist_ok=True)

app.include_router(recordings.router)

@app.get("/health")
async def health_check():
    """Health check — used by Docker Compose and load balancers."""
    return {"status": "ok"}

