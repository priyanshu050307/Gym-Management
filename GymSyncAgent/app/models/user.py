from sqlalchemy import Column, String, DateTime
from app.database.db import Base
import datetime

class UserCache(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)  # Local User ID on Device
    card_number = Column(String, nullable=True)
    name = Column(String, nullable=True)
    role = Column(String, default="MEMBER")
    fingerprint_template = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
