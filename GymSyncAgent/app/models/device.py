from sqlalchemy import Column, String, Integer, DateTime, Boolean
from app.database.db import Base
import datetime

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True)  # Unique ID / MAC
    name = Column(String, nullable=False)
    ip = Column(String, nullable=False)
    port = Column(Integer, default=4370)
    vendor = Column(String, default="ZKTECO")
    branch_id = Column(String, nullable=False)
    status = Column(String, default="DISCONNECTED")
    last_sync = Column(DateTime, nullable=True)
    is_online = Column(Boolean, default=False)
    model = Column(String, nullable=True)
    firmware = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
