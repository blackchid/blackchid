"""
database.py — SQLAlchemy engine, session factory, and FastAPI dependency.

Usage in a route:
    from database import get_db
    from sqlalchemy.orm import Session

    @app.get("/example")
    def example(db: Session = Depends(get_db)):
        ...
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# DATABASE_URL is injected by Docker Compose (or a local .env file).
# Format: postgresql://user:password@host:port/dbname
DATABASE_URL = os.environ["DATABASE_URL"]

# connect_args is only needed for SQLite; Postgres works without it.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Each request gets its own session; autocommit/autoflush are off so
# we control transactions explicitly.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
