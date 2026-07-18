"""
schemas/user.py — Pydantic models for user-facing request/response bodies.

Separation of concerns:
  • UserCreate  — what the client sends when registering (includes plain password)
  • UserRead    — what we return to the client (NEVER includes any password)
  • UserUpdate  — partial edits (full_name only for now)
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Registration payload — plain password accepted here, then immediately hashed."""
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")
    full_name: str | None = None


class UserRead(BaseModel):
    """Safe representation returned to the client — no password field."""
    id: str
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Fields the user may change via PATCH /auth/me."""
    full_name: str | None = None


class TokenResponse(BaseModel):
    """
    Standard OAuth2 token response shape.
    access_token: the JWT the client must include in every subsequent request.
    token_type:   always "bearer" — tells the client which Auth scheme to use.
    """
    access_token: str
    token_type: str = "bearer"
