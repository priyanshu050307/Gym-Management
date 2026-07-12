from sqlalchemy import Column, Integer, DateTime, String
from app.database.db import Base
import datetime

class SyncHistory(Base):
    __tablename__ = "sync_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_time = Column(DateTime, default=datetime.datetime.utcnow)
    logs_fetched = Column(Integer, default=0)
    logs_uploaded = Column(Integer, default=0)
    status = Column(String, default="SUCCESS")  # SUCCESS, FAILED
    details = Column(String, nullable=True)
