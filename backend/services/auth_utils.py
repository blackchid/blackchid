"""
services/auth_utils.py — Password hashing and JWT helpers.

Why not fastapi-users?
  fastapi-users v11+ requires async SQLAlchemy. This project uses sync
  SQLAlchemy throughout. Rather than refactor everything, we implement
  the same primitives (bcrypt + python-jose) that fastapi-users uses
  internally. The API surface is identical.

Learning notes:
  • bcrypt: a slow, salted hash algorithm designed for passwords.
    "Slow" is intentional — it makes brute-force attacks expensive.
  • JWT (JSON Web Token): a signed, self-contained token.
    Header.Payload.Signature — the server can verify any token it issued
    without hitting the database, because only we know the SECRET_KEY.
  • Bearer token flow:
      1. Client logs in  → server returns {"access_token": "..."}
      2. Client stores the token and sends it in every request header:
            Authorization: Bearer <token>
      3. Server verifies signature and reads the user_id from the payload.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

# ── Password hashing ──────────────────────────────────────────────────────────
# CryptContext knows which algorithm to use and handles migration if you
# ever switch algorithms — existing hashes keep working.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of `plain`. Store this, never the plain password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if `plain` matches the stored `hashed` value."""
    return _pwd_context.verify(plain, hashed)


# ── JWT configuration ─────────────────────────────────────────────────────────
# SECRET_KEY should be a long random string in production.
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY: str = os.environ.get("SECRET_KEY", "CHANGE_ME_IN_PRODUCTION_use_secrets_token_hex_32")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 h


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """
    Create a signed JWT.

    `subject` is typically the user's UUID string (the "sub" claim).
    The token expires after ACCESS_TOKEN_EXPIRE_MINUTES minutes.
    """
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT. Raises JWTError if invalid or expired.

    FastAPI dependency `get_current_user` calls this and maps errors
    to HTTP 401 responses so callers never see raw JWTError.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
