from sqlalchemy import Column, String, DateTime
from app.database.db import Base
import datetime

class Command(Base):
    __tablename__ = "commands"
    
    id = Column(String, primary_key=True)  # Cloud command UUID
    action = Column(String, nullable=False)  # ADD_MEMBER, DELETE_MEMBER, etc.
    payload = Column(String, nullable=True)  # JSON payload
    status = Column(String, default="PENDING")  # PENDING, EXECUTED, FAILED
    error_message = Column(String, nullable=True)
    received_at = Column(DateTime, default=datetime.datetime.utcnow)
    executed_at = Column(DateTime, nullable=True)
