import os
import sys

# Add backend directory to sys.path if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "postgresql://volt@127.0.0.1:5432/uxr_db"

from database import DATABASE_URL
from models.project import Project
from models.recording import Recording
from models.transcript_segment import TranscriptSegment
from services.pii import process_and_store_pii

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main():
    db = SessionLocal()
    
    # 1. Setup dummy data
    print("Setting up dummy data...")
    project_id = str(uuid.uuid4())
    recording_id = str(uuid.uuid4())
    segment_id = str(uuid.uuid4())
    
    project = Project(id=project_id, name="PII Test Project")
    db.add(project)
    
    recording = Recording(
        id=recording_id,
        project_id=project_id,
        filename="test_pii.mp3",
        status="done"
    )
    db.add(recording)
    
    text = "My name is John Doe, email me at john.doe@example.com or call 555-123-4567."
    segment = TranscriptSegment(
        id=segment_id,
        recording_id=recording_id,
        start_time=0.0,
        end_time=10.0,
        text=text,
        speaker_label="SPEAKER_00"
    )
    db.add(segment)
    db.commit()
    
    # 2. Run PII detection
    print(f"Running PII detection on text: '{text}'...")
    detections = process_and_store_pii(db, segment_id, text)
    
    print(f"Detected {len(detections)} entities:")
    for d in detections:
        print(f" - {d.entity_type} ({d.confidence}): '{text[d.start_char:d.end_char]}'")
        
    # Validate expected
    types = {d.entity_type for d in detections}
    if "PERSON" in types and "EMAIL_ADDRESS" in types and "PHONE_NUMBER" in types:
        print("SUCCESS: PERSON, EMAIL_ADDRESS, and PHONE_NUMBER were detected.")
    else:
        print(f"WARNING: Missing expected entities. Found: {types}")
        
    db.close()

if __name__ == "__main__":
    main()
