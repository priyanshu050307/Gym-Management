from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.command import Command
from typing import List

class CommandRepository(BaseRepository[Command]):
    def __init__(self, db: Session):
        super().__init__(Command, db)
        
    def get_pending_commands(self) -> List[Command]:
        return (
            self.db.query(self.model)
            .filter(self.model.status == "PENDING")
            .order_by(self.model.received_at.asc())
            .all()
        )
