from presidio_analyzer import AnalyzerEngine
from sqlalchemy.orm import Session
from models.pii_detection import PIIDetection

# Initialize singleton AnalyzerEngine
analyzer = AnalyzerEngine()

def process_and_store_pii(db: Session, segment_id: str, text: str) -> list[PIIDetection]:
    """
    Run Presidio analyzer on the given text and store detected PII.
    """
    results = analyzer.analyze(text=text, language='en')
    detections = []
    
    for res in results:
        detection = PIIDetection(
            segment_id=segment_id,
            entity_type=res.entity_type,
            start_char=res.start,
            end_char=res.end,
            confidence=res.score
        )
        db.add(detection)
        detections.append(detection)
        
    db.commit()
    for d in detections:
        db.refresh(d)
        
    return detections
