import asyncio
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.user import User
from models.project import Project
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from services.auth_utils import hash_password
import httpx
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://volt@127.0.0.1:5432/uxr_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_db():
    db = SessionLocal()
    
    # 1. Create a User
    user = db.query(User).filter(User.email == "context_test@example.com").first()
    if not user:
        user = User(email="context_test@example.com", hashed_password=hash_password("password123"), is_active=True, full_name="Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Create a Project
    project = Project(name="Context AI Tagging Project")
    db.add(project)
    db.commit()
    db.refresh(project)
    
    from models.project_member import ProjectMember
    member = ProjectMember(project_id=project.id, user_id=user.id, role="editor")
    db.add(member)
    db.commit()

    # 3. Create a Recording
    recording = Recording(project_id=project.id, filename="interview1.mp4", status="done")
    db.add(recording)
    db.commit()
    db.refresh(recording)

    # 4. Create Transcript Segments (Out of order scenario)
    s1 = TranscriptSegment(recording_id=recording.id, start_time=1.0, end_time=5.0, speaker_label="Interviewer", text="How do you feel about our pricing model?")
    s2 = TranscriptSegment(recording_id=recording.id, start_time=6.0, end_time=10.0, speaker_label="Participant", text="I'll get to that in a second, first I want to mention the UI. It's too cluttered.")
    s3 = TranscriptSegment(recording_id=recording.id, start_time=11.0, end_time=14.0, speaker_label="Interviewer", text="Got it, any specific screen?")
    # TARGET SEGMENT
    s4 = TranscriptSegment(recording_id=recording.id, start_time=15.0, end_time=20.0, speaker_label="Participant", text="The dashboard mostly. Oh, and about your earlier question, it's way too expensive for us.")
    
    db.add_all([s1, s2, s3, s4])
    db.commit()
    db.refresh(s4)

    user_email = user.email
    project_id = project.id
    seg_id = s4.id
    seg_text = s4.text
    db.close()
    return user_email, "password123", project_id, seg_id, seg_text

async def run_test():
    email, pwd, proj_id, seg_id, seg_text = seed_db()
    print(f"Target Segment: {seg_text}")
    print(f"Segment ID: {seg_id}")
    
    # Get JWT
    async with httpx.AsyncClient() as client:
        r = await client.post("http://127.0.0.1:8000/auth/login", data={"username": email, "password": pwd})
        token = r.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: Single segment (Mocking the old logic by passing only the segment text if it was still supported)
        # But wait! We changed the endpoint to require segment_id and it automatically fetches context.
        # So we can't test "without context" against our endpoint easily anymore unless we build a toggle or mock it.
        # For the sake of the experiment, we'll hit Ollama directly with just the single string, and then hit our endpoint!
        
        print("\n--- TEST 1: NO CONTEXT (Direct Ollama Call) ---")
        prompt = f"""You are an expert UX Researcher. Analyze the following transcript segment and provide 3-5 concise, specific tags that categorize the user's feedback or behavior. 
Return ONLY a JSON array of strings. No markdown formatting, no explanations.

Text: {seg_text}
"""
        try:
            r_ollama = await client.post("http://127.0.0.1:11434/api/generate", json={"model": "llama3", "prompt": prompt, "stream": False, "format": "json"})
            if r_ollama.status_code == 200:
                print(r_ollama.json().get("response"))
            else:
                print("Ollama failed:", r_ollama.text)
        except Exception as e:
            print("Ollama direct call failed:", str(e))
            
        print("\n--- TEST 2: WITH CONTEXT (Backend API Call) ---")
        r_api = await client.post(f"http://127.0.0.1:8000/projects/{proj_id}/tags/suggest", headers=headers, json={"segment_id": seg_id})
        if r_api.status_code == 200:
            print(json.dumps(r_api.json(), indent=2))
        else:
            print("API failed:", r_api.status_code, r_api.text)

if __name__ == "__main__":
    asyncio.run(run_test())
