import os
import sys

from mcp.server.fastmcp import FastMCP
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import models
from models.project import Project
from models.recording import Recording
from models.tag import Tag
from models.tag_application import TagApplication
from models.transcript_segment import TranscriptSegment
from models.insight import Insight

# Create the FastMCP server instance
mcp = FastMCP("Blackchid_UXR")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://volt@127.0.0.1:5432/uxr_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@mcp.tool()
def search_insights(query: str) -> str:
    """
    Search across UX research insights for a given keyword or topic.
    Returns matching insights with their title and description.
    """
    db = SessionLocal()
    try:
        search_term = f"%{query}%"
        insights = db.query(Insight).filter(
            (Insight.title.ilike(search_term)) | (Insight.description.ilike(search_term))
        ).limit(10).all()
        
        if not insights:
            return f"No insights found matching: '{query}'."
            
        result = [f"Found {len(insights)} matching insights:\n"]
        for insight in insights:
            result.append(f"Insight ID: {insight.id}\nTitle: {insight.title}\nProject ID: {insight.project_id}\nDescription:\n{insight.description}\n")
            
        return "\n---\n".join(result)
    finally:
        db.close()

@mcp.tool()
def get_project_summary(project_id: str) -> str:
    """
    Retrieve high-level statistics and metadata for a specific UX research project.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return f"Project with ID '{project_id}' not found."
            
        recording_count = db.query(Recording).filter(Recording.project_id == project_id).count()
        insight_count = db.query(Insight).filter(Insight.project_id == project_id).count()
        tag_count = db.query(Tag).filter(Tag.project_id == project_id).count()
        
        summary = (
            f"Project Name: {project.name}\n"
            f"Description: {project.description or 'N/A'}\n"
            f"Total Recordings: {recording_count}\n"
            f"Total Tags: {tag_count}\n"
            f"Total Insights: {insight_count}\n"
        )
        return summary
    finally:
        db.close()

@mcp.tool()
def get_segments_by_tag(tag: str) -> str:
    """
    Retrieve all raw transcript segments associated with a specific tag name.
    """
    db = SessionLocal()
    try:
        # Join TranscriptSegment -> TagApplication -> Tag
        results = (
            db.query(TranscriptSegment, Tag, Recording)
            .join(TagApplication, TagApplication.segment_id == TranscriptSegment.id)
            .join(Tag, Tag.id == TagApplication.tag_id)
            .join(Recording, Recording.id == TranscriptSegment.recording_id)
            .filter(Tag.name.ilike(tag))
            .limit(20)
            .all()
        )
        
        if not results:
            return f"No transcript segments found with the tag: '{tag}'."
            
        output = [f"Found {len(results)} segments for tag '{tag}':\n"]
        for segment, t, recording in results:
            output.append(
                f"Recording: {recording.filename}\n"
                f"Project ID: {recording.project_id}\n"
                f"Time: {segment.start_time:.1f}s - {segment.end_time:.1f}s\n"
                f"Speaker: {segment.speaker_label}\n"
                f"Text: \"{segment.text}\"\n"
            )
            
        return "\n---\n".join(output)
    finally:
        db.close()

if __name__ == "__main__":
    # Runs the server over STDIO which is compatible with Cursor and Claude Desktop/Code
    mcp.run()
