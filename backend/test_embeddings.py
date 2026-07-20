import asyncio
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.user import User
from models.project import Project
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from services.embeddings import generate_embeddings

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://volt@127.0.0.1:5432/uxr_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_test():
    db = SessionLocal()
    
    # 1. Create a Project and Recording for foreign keys
    project = Project(name="Embedding Test Project")
    db.add(project)
    db.commit()
    db.refresh(project)
    
    recording = Recording(project_id=project.id, filename="test_audio.mp4", status="done")
    db.add(recording)
    db.commit()
    db.refresh(recording)
    
    # 2. Verify Embeddings Service
    print("Testing generate_embeddings()...")
    test_texts = ["This is a test segment.", "Another one about UX."]
    vectors = generate_embeddings(test_texts)
    
    print(f"Generated {len(vectors)} vectors.")
    print(f"Dimensions of first vector: {len(vectors[0])}")
    
    assert len(vectors[0]) == 384, f"Expected 384 dimensions, got {len(vectors[0])}"
    
    # 3. Verify DB Storage
    print("Testing DB insertion...")
    segment = TranscriptSegment(
        recording_id=recording.id, 
        start_time=0.0, 
        end_time=5.0, 
        speaker_label="Speaker 1", 
        text=test_texts[0],
        embedding=vectors[0]
    )
    
    db.add(segment)
    db.commit()
    db.refresh(segment)
    
    # Read it back
    stored_segment = db.query(TranscriptSegment).filter(TranscriptSegment.id == segment.id).first()
    stored_dim = len(stored_segment.embedding)
    print(f"Successfully stored and retrieved embedding with {stored_dim} dimensions!")
    
    db.close()

if __name__ == "__main__":
    run_test()
