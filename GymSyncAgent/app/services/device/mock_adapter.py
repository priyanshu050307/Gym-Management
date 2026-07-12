import datetime
import random
from typing import List, Dict, Any, Optional
from app.services.device.adapter import DeviceAdapter

class MockAdapter(DeviceAdapter):
    """Simulated biometric device adapter for development, testing, and UI demonstration."""
    
    def __init__(self, ip: str, port: int = 4370):
        self.ip = ip
        self.port = port
        self.connected = False
        self.users = {
            "1": {"name": "John Doe", "card_number": "1001"},
            "2": {"name": "Jane Smith", "card_number": "1002"},
        }
        
    def connect(self) -> bool:
        self.connected = True
        return True
        
    def disconnect(self) -> None:
        self.connected = False
        
    def get_device_info(self) -> Dict[str, Any]:
        if not self.connected:
            raise RuntimeError("Device not connected")
        return {
            "vendor": "MockVendor",
            "model": "Mock-990",
            "firmware": "v2.0.5",
            "mac": "00:11:22:33:44:55",
            "user_count": len(self.users)
        }
        
    def get_attendance_logs(self) -> List[Dict[str, Any]]:
        if not self.connected:
            raise RuntimeError("Device not connected")
            
        # Generate some mock check-in logs
        logs = []
        user_ids = list(self.users.keys())
        if user_ids:
            for _ in range(random.randint(1, 5)):
                uid = random.choice(user_ids)
                logs.append({
                    "member_id": uid,
                    "timestamp": datetime.datetime.now() - datetime.timedelta(seconds=random.randint(1, 100))
                })
        return logs
        
    def add_user(self, user_id: str, name: str, card_number: Optional[str] = None, fingerprint: Optional[str] = None) -> bool:
        self.users[user_id] = {"name": name, "card_number": card_number}
        return True
        
    def delete_user(self, user_id: str) -> bool:
        if user_id in self.users:
            del self.users[user_id]
            return True
        return False
        
    def update_user(self, user_id: str, name: str, card_number: Optional[str] = None) -> bool:
        if user_id in self.users:
            self.users[user_id] = {"name": name, "card_number": card_number}
            return True
        return False
        
    def sync_time(self, dt: datetime.datetime) -> bool:
        return True
        
    def restart_device(self) -> bool:
        return True
        
    def clear_logs(self) -> bool:
        return True
