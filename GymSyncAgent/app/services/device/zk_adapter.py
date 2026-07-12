from typing import List, Dict, Any, Optional
import datetime
from app.services.device.adapter import DeviceAdapter
from app.utils.logger import device_logger

class ZKTecoAdapter(DeviceAdapter):
    """Concrete adapter implementing ZKTeco device communications."""
    
    def __init__(self, ip: str, port: int = 4370):
        self.ip = ip
        self.port = port
        self.zk = None
        self.conn = None
        
    def connect(self) -> bool:
        device_logger.info(f"Connecting to ZKTeco device at {self.ip}:{self.port}...")
        try:
            # Dynamically import zk to prevent crash if pyzk is not installed
            from zk import ZK
            self.zk = ZK(self.ip, port=self.port, timeout=5)
            self.conn = self.zk.connect()
            device_logger.info(f"Successfully connected to ZKTeco device at {self.ip}")
            return True
        except Exception as e:
            device_logger.error(f"ZKTeco connection failed to {self.ip}: {e}")
            self.conn = None
            return False
            
    def disconnect(self) -> None:
        if self.conn:
            try:
                self.conn.disconnect()
            except Exception:
                pass
            self.conn = None
            
    def get_device_info(self) -> Dict[str, Any]:
        if not self.conn:
            raise RuntimeError("ZKTeco device is not connected")
        try:
            firmware = self.conn.get_firmware_version()
            device_name = self.conn.get_device_name()
            return {
                "vendor": "ZKTeco",
                "model": device_name or "ZK-Standard",
                "firmware": firmware or "v1.0.0",
                "mac": "N/A"
            }
        except Exception as e:
            device_logger.error(f"Failed to fetch ZKTeco device info: {e}")
            return {"vendor": "ZKTeco", "model": "ZK-Error", "firmware": "N/A", "mac": "N/A"}
            
    def get_attendance_logs(self) -> List[Dict[str, Any]]:
        if not self.conn:
            raise RuntimeError("ZKTeco device is not connected")
        try:
            logs = []
            attendance = self.conn.get_attendance()
            for record in attendance:
                logs.append({
                    "member_id": str(record.user_id),
                    "timestamp": record.timestamp
                })
            return logs
        except Exception as e:
            device_logger.error(f"Failed to get attendance from ZKTeco: {e}")
            return []
            
    def add_user(self, user_id: str, name: str, card_number: Optional[str] = None, fingerprint: Optional[str] = None) -> bool:
        if not self.conn:
            return False
        try:
            # ZK user registration logic
            self.conn.set_user(uid=int(user_id), user_id=user_id, name=name, privilege=0, cardport=int(card_number) if card_number and card_number.isdigit() else 0)
            return True
        except Exception as e:
            device_logger.error(f"Failed to add user to ZKTeco: {e}")
            return False
            
    def delete_user(self, user_id: str) -> bool:
        if not self.conn:
            return False
        try:
            self.conn.delete_user(uid=int(user_id))
            return True
        except Exception as e:
            device_logger.error(f"Failed to delete user from ZKTeco: {e}")
            return False
            
    def update_user(self, user_id: str, name: str, card_number: Optional[str] = None) -> bool:
        return self.add_user(user_id, name, card_number)
        
    def sync_time(self, dt: datetime.datetime) -> bool:
        if not self.conn:
            return False
        try:
            self.conn.set_time(dt)
            return True
        except Exception as e:
            device_logger.error(f"Failed to sync clock on ZKTeco: {e}")
            return False
            
    def restart_device(self) -> bool:
        if not self.conn:
            return False
        try:
            self.conn.restart()
            return True
        except Exception as e:
            device_logger.error(f"Failed to restart ZKTeco: {e}")
            return False
            
    def clear_logs(self) -> bool:
        if not self.conn:
            return False
        try:
            self.conn.clear_attendance()
            return True
        except Exception as e:
            device_logger.error(f"Failed to clear ZKTeco logs: {e}")
            return False
