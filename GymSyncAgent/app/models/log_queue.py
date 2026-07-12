from sqlalchemy import Column, Integer, String, DateTime
from app.database.db import Base
import datetime

class AttendanceQueue(Base):
    __tablename__ = "attendance_queue"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    member_id = Column(String, nullable=False)
    device_id = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    status = Column(String, default="PENDING")  # PENDING, UPLOADED, FAILED
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    uploaded_at = Column(DateTime, nullable=True)
