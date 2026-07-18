from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.project_member import ProjectMember
from models.recording import Recording
from models.tag import Tag
from models.user import User


def get_project_role(db: Session, user: User, project_id: str) -> str:
    """Returns the user's role ('editor' or 'viewer') in the project, or raises 403."""
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not a member of this project"
        )
    return member.role


def require_project_role(db: Session, user: User, project_id: str, allowed_roles: list[str]) -> str:
    """Ensures the user has one of the allowed roles in the project."""
    role = get_project_role(db, user, project_id)
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Insufficient permissions for this project"
        )
    return role


def require_recording_role(db: Session, user: User, recording_id: str, allowed_roles: list[str]) -> str:
    """Ensures the user has an allowed role for the project containing the recording."""
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    return require_project_role(db, user, str(recording.project_id), allowed_roles)


def require_tag_role(db: Session, user: User, tag_id: str, allowed_roles: list[str]) -> str:
    """Ensures the user has an allowed role for the project containing the tag."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return require_project_role(db, user, str(tag.project_id), allowed_roles)
