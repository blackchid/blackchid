"""
routers/auth.py — Signup, login, and current-user endpoints.

Endpoint summary:
  POST /auth/register  — create a new account
  POST /auth/login     — exchange email+password for a JWT
  GET  /auth/me        — return the logged-in user's profile
  PATCH /auth/me       — update full_name

How authentication works end-to-end:
  1. Client calls POST /auth/login with {username, password} (OAuth2 form).
  2. We look up the user by email, verify the bcrypt hash.
  3. We mint a JWT containing {"sub": "<user-uuid>"} and return it.
  4. Client stores the token and sends it as:
         Authorization: Bearer <token>
  5. get_current_user() dependency decodes the JWT, reads the user_id,
     fetches the User row, and injects it into the route handler.
  6. If the token is missing/expired/tampered with → HTTP 401.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.user import TokenResponse, UserCreate, UserRead, UserUpdate
from services.auth_utils import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# ── OAuth2 scheme ─────────────────────────────────────────────────────────────
# This tells FastAPI where to find the token in the request.
# "tokenUrl" is the path clients call to get a token — used by Swagger UI
# to show the 🔓 Authorize button.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Shared dependency: resolve JWT → User ─────────────────────────────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency used by any route that requires an authenticated user.

    Usage in a route:
        @router.get("/protected")
        def protected(user: User = Depends(get_current_user)):
            return {"hello": user.email}

    Raises HTTP 401 if the token is missing, expired, or has been tampered with.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_error
    return user


# decode_token imported from auth_utils — defined here inline to avoid
# a circular import (router → auth_utils → nothing back)
from services.auth_utils import decode_access_token as decode_token  # noqa: E402


# ── POST /auth/register ───────────────────────────────────────────────────────
@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user account.

    • Checks that the email isn't already taken.
    • Hashes the password before storing — the plain-text password never
      touches the database.
    • Returns the new user profile (no password).
    """
    # Reject duplicate emails early with a clear error
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── POST /auth/login ──────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Exchange email + password for a JWT access token.

    We deliberately give the same vague error for "no such user" AND
    "wrong password" — this prevents attackers from discovering valid emails
    (user enumeration attack).

    Note: OAuth2PasswordRequestForm expects the email in the `username` field.
    This is an OAuth2 standard quirk — it calls it `username` even when
    you use email addresses. In Swagger UI just type your email there.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive.")

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)


# ── GET /auth/me ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


# ── PATCH /auth/me ────────────────────────────────────────────────────────────
@router.patch("/me", response_model=UserRead)
def update_me(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update editable fields on the current user's profile."""
    if updates.full_name is not None:
        current_user.full_name = updates.full_name
    db.commit()
    db.refresh(current_user)
    return current_user
