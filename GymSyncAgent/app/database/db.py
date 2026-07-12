from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

DATABASE_URL = "sqlite:///gym_sync.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

@contextmanager
def get_db():
    """Context manager for database sessions, ensuring sessions are closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_dep():
    """Generator for FastAPI dependency injection, ensuring sessions are closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initializes SQLite database and creates all tables."""
    # Import all models here so that they register on Base
    from app.models.device import Device
    from app.models.log_queue import AttendanceQueue
    from app.models.user import UserCache
    from app.models.command import Command
    from app.models.sync_history import SyncHistory
    
    Base.metadata.create_all(bind=engine)
