import asyncio
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()

def get_current_user_flexible(request: Request):
    auth_header = request.headers.get("Authorization", "")
    tok = None
    if auth_header.startswith("Bearer "):
        tok = auth_header[7:]
    if not tok:
        tok = request.query_params.get("token")
    if not tok:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return tok

@app.get("/audio")
def stream_audio(token: str = None, user: str = Depends(get_current_user_flexible)):
    return {"token": token, "user": user}

client = TestClient(app)
response = client.get("/audio?token=helloworld")
print(response.status_code, response.json())
