import asyncio
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.user import User
from models.project import Project
from models.project_member import ProjectMember
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
    user = db.query(User).filter(User.email == "review_test@example.com").first()
    if not user:
        user = User(email="review_test@example.com", hashed_password=hash_password("password123"), is_active=True, full_name="Review User")
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Create a Project
    project = Project(name="Review AI Tagging Project")
    db.add(project)
    db.commit()
    db.refresh(project)
    
    member = ProjectMember(project_id=project.id, user_id=user.id, role="editor")
    db.add(member)
    db.commit()

    # 3. Create a Recording
    recording = Recording(project_id=project.id, filename="interview2.mp4", status="done")
    db.add(recording)
    db.commit()
    db.refresh(recording)

    # 4. Create Transcript Segment
    s = TranscriptSegment(recording_id=recording.id, start_time=1.0, end_time=5.0, speaker_label="Participant", text="I love the new layout!")
    
    db.add(s)
    db.commit()
    db.refresh(s)
    
    user_email = user.email
    project_id = project.id
    seg_id = s.id
    
    db.close()
    return user_email, "password123", project_id, seg_id

async def run_test():
    email, pwd, proj_id, seg_id = seed_db()
    
    async with httpx.AsyncClient() as client:
        r = await client.post("http://127.0.0.1:8000/auth/login", data={"username": email, "password": pwd})
        token = r.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        print("1. Triggering AI Suggestion Endpoint...")
        r_api = await client.post(f"http://127.0.0.1:8000/projects/{proj_id}/tags/suggest", headers=headers, json={"segment_id": seg_id})
        print(json.dumps(r_api.json(), indent=2))
        
        print("\n2. Fetching Pending Suggestions...")
        r_get = await client.get(f"http://127.0.0.1:8000/projects/{proj_id}/tags/suggestions", headers=headers)
        suggestions = r_get.json()
        print(json.dumps(suggestions, indent=2))
        
        if len(suggestions) < 2:
            print("Not enough suggestions generated to test accept/reject")
            return
            
        sugg1 = suggestions[0]
        sugg2 = suggestions[1]
        
        print(f"\n3. Accepting Suggestion 1: {sugg1['suggested_name']}")
        r_acc = await client.post(f"http://127.0.0.1:8000/tags/suggestions/{sugg1['id']}/accept", headers=headers)
        print(r_acc.status_code, r_acc.json())
        
        print(f"\n4. Rejecting Suggestion 2: {sugg2['suggested_name']}")
        r_rej = await client.post(f"http://127.0.0.1:8000/tags/suggestions/{sugg2['id']}/reject", headers=headers)
        print(r_rej.status_code, r_rej.json())

if __name__ == "__main__":
    asyncio.run(run_test())
