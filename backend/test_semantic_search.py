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
from services.embeddings import generate_embeddings
import httpx
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://volt@127.0.0.1:5432/uxr_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_db():
    db = SessionLocal()
    
    # 1. Create a User
    user = db.query(User).filter(User.email == "search_test@example.com").first()
    if not user:
        user = User(email="search_test@example.com", hashed_password=hash_password("password123"), is_active=True, full_name="Search User")
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Create a Project
    project = Project(name="Semantic Search Project")
    db.add(project)
    db.commit()
    db.refresh(project)
    
    member = ProjectMember(project_id=project.id, user_id=user.id, role="editor")
    db.add(member)
    db.commit()

    # 3. Create a Recording
    recording = Recording(project_id=project.id, filename="usability_test.mp4", status="done")
    db.add(recording)
    db.commit()
    db.refresh(recording)

    # 4. Create Transcript Segments with exact target phrase
    texts = [
        "I'm having trouble finding the logout button",
        "The colors on this page look really nice.",
        "Could you tell me what the pricing is?",
        "I am looking for the main menu."
    ]
    
    # Generate embeddings to simulate background processing
    embeddings = generate_embeddings(texts)
    
    for i, text in enumerate(texts):
        s = TranscriptSegment(
            recording_id=recording.id, 
            start_time=float(i), 
            end_time=float(i)+1.0, 
            speaker_label="Participant", 
            text=text,
            embedding=embeddings[i]
        )
        db.add(s)
        
    db.commit()
    
    user_email = user.email
    project_id = project.id
    
    db.close()
    return user_email, "password123", project_id

async def run_test():
    email, pwd, proj_id = seed_db()
    
    async with httpx.AsyncClient() as client:
        r = await client.post("http://127.0.0.1:8000/auth/login", data={"username": email, "password": pwd})
        token = r.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        query = "Can't locate sign out"
        print(f"\n1. Searching for: '{query}'")
        
        r_api = await client.get(f"http://127.0.0.1:8000/projects/{proj_id}/search?q={query}", headers=headers)
        
        if r_api.status_code != 200:
            print(f"Error: {r_api.status_code} - {r_api.text}")
            return
            
        data = r_api.json()
        print(f"\nFound {len(data['results'])} results.\n")
        
        for i, res in enumerate(data['results']):
            print(f"Rank {i+1}: (Score: {res['similarity_score']:.3f})")
            print(f"Text: \"{res['text']}\"\n")

if __name__ == "__main__":
    asyncio.run(run_test())
