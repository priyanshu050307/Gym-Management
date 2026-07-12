from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.device import Device
from typing import List

class DeviceRepository(BaseRepository[Device]):
    def __init__(self, db: Session):
        super().__init__(Device, db)
        
    def get_online_devices(self) -> List[Device]:
        return self.db.query(self.model).filter(self.model.is_online == True).all()
