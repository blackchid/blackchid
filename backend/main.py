from fastapi import FastAPI

app = FastAPI(title="UXR Platform API")


@app.get("/health")
async def health_check():
    """Health check — used by Docker Compose and load balancers."""
    return {"status": "ok"}
