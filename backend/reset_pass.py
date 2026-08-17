from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.auth_utils import hash_password
from models.user import User

DATABASE_URL = "postgresql://localhost:5432/uxr_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

hashed = hash_password("password123")

for email in ["demo@papom.dev", "admin@company.com"]:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.hashed_password = hashed
        db.commit()
        print(f"Updated {email} password to 'password123'")
    else:
        print(f"User {email} not found")

db.close()
