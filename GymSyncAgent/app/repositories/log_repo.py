from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.log_queue import AttendanceQueue
from typing import List
import datetime

class AttendanceQueueRepository(BaseRepository[AttendanceQueue]):
    def __init__(self, db: Session):
        super().__init__(AttendanceQueue, db)
        
    def get(self, id: int) -> AttendanceQueue:
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_pending_logs(self, limit: int = 100) -> List[AttendanceQueue]:
        return (
            self.db.query(self.model)
            .filter(self.model.status == "PENDING")
            .order_by(self.model.timestamp.asc())
            .limit(limit)
            .all()
        )
        
    def check_duplicate(self, member_id: str, timestamp: datetime.datetime) -> bool:
        """Verify if a log with the same user and timestamp exists."""
        exists = (
            self.db.query(self.model)
            .filter(
                self.model.member_id == member_id,
                self.model.timestamp == timestamp
            )
            .first()
        )
        return exists is not None
