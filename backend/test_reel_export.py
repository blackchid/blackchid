import asyncio
import os
import subprocess
import httpx

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.user import User
from models.project import Project
from models.project_member import ProjectMember
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from services.auth_utils import hash_password

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://volt@127.0.0.1:5432/uxr_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_dummy_mp4(filepath: str):
    """Generate a 5-second blank mp4 with silent audio."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    if not os.path.exists(filepath):
        cmd = [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=1280x720:d=5",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-c:v", "libx264",
            "-c:a", "aac", "-shortest", filepath
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def seed_db():
    db = SessionLocal()
    
    # 1. Create a User
    user = db.query(User).filter(User.email == "reel_test@example.com").first()
    if not user:
        user = User(email="reel_test@example.com", hashed_password=hash_password("password123"), is_active=True, full_name="Reel User")
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Create a Project
    project = Project(name="Reel Export Project")
    db.add(project)
    db.commit()
    db.refresh(project)
    
    member = ProjectMember(project_id=project.id, user_id=user.id, role="editor")
    db.add(member)
    db.commit()

    # Create dummy media
    dummy_path = os.path.abspath("uploads/dummy_reel_source.mp4")
    create_dummy_mp4(dummy_path)

    # 3. Create Recording 1 (WITHOUT external sharing consent)
    rec_no_consent = Recording(
        project_id=project.id, 
        filename="no_consent.mp4", 
        status="done", 
        consent_external_sharing=False,
        storage_path=dummy_path
    )
    db.add(rec_no_consent)
    db.commit()
    db.refresh(rec_no_consent)

    # 4. Create Recording 2 (WITH external sharing consent)
    rec_consent = Recording(
        project_id=project.id, 
        filename="yes_consent.mp4", 
        status="done", 
        consent_external_sharing=True,
        storage_path=dummy_path
    )
    db.add(rec_consent)
    db.commit()
    db.refresh(rec_consent)

    # 5. Create Segments
    seg1 = TranscriptSegment(recording_id=rec_no_consent.id, start_time=1.0, end_time=3.0, speaker_label="P1", text="No share")
    seg2 = TranscriptSegment(recording_id=rec_consent.id, start_time=2.0, end_time=4.0, speaker_label="P1", text="Yes share")
    db.add_all([seg1, seg2])
    db.commit()
    db.refresh(seg1)
    db.refresh(seg2)
    
    user_email = user.email
    project_id = project.id
    seg1_id = seg1.id
    seg2_id = seg2.id
    
    db.close()
    return user_email, "password123", project_id, seg1_id, seg2_id

async def run_test():
    email, pwd, proj_id, s_no_consent, s_consent = seed_db()
    
    async with httpx.AsyncClient() as client:
        r = await client.post("http://127.0.0.1:8000/auth/login", data={"username": email, "password": pwd})
        token = r.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"\n1. Attempting to export reel WITH segment lacking external sharing consent...")
        r_fail = await client.post(
            f"http://127.0.0.1:8000/projects/{proj_id}/export-reel", 
            headers=headers,
            json={"segment_ids": [s_no_consent]}
        )
        print(f"Status: {r_fail.status_code}")
        print(f"Response: {r_fail.json()}")
        
        print(f"\n2. Attempting to export reel ONLY WITH consented segments...")
        r_succ = await client.post(
            f"http://127.0.0.1:8000/projects/{proj_id}/export-reel", 
            headers=headers,
            json={"segment_ids": [s_consent]}
        )
        print(f"Status: {r_succ.status_code}")
        
        if r_succ.status_code == 200:
            print(f"Success! Final Reel Size: {len(r_succ.content)} bytes")
            # Write out to verify
            with open("test_final_reel.mp4", "wb") as f:
                f.write(r_succ.content)
            print("Saved output to 'backend/test_final_reel.mp4' for manual verification.")

if __name__ == "__main__":
    asyncio.run(run_test())
