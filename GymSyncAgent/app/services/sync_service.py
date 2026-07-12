import datetime
from sqlalchemy.orm import Session
from app.models.device import Device
from app.models.log_queue import AttendanceQueue
from app.models.sync_history import SyncHistory
from app.repositories.device_repo import DeviceRepository
from app.repositories.log_repo import AttendanceQueueRepository
from app.services.device.adapter import DeviceAdapter
from app.services.device.zk_adapter import ZKTecoAdapter
from app.services.device.essl_adapter import ESSLAdapter
from app.services.device.mock_adapter import MockAdapter
from app.utils.logger import attendance_logger, error_logger, scheduler_logger

def get_adapter_for_device(device: Device) -> DeviceAdapter:
    vendor_lower = device.vendor.lower()
    if vendor_lower == "essl":
        return ESSLAdapter(device.ip, device.port)
    elif vendor_lower == "mock":
        return MockAdapter(device.ip, device.port)
    else:
        return ZKTecoAdapter(device.ip, device.port)

class SyncService:
    def __init__(self, db: Session):
        self.db = db
        self.device_repo = DeviceRepository(db)
        self.log_repo = AttendanceQueueRepository(db)

    def sync_all_devices(self) -> None:
        """Pulls attendance logs from all registered devices and queues them locally."""
        devices = self.device_repo.get_all()
        scheduler_logger.info(f"Sync runner: starting log collection across {len(devices)} devices...")
        
        for device in devices:
            adapter = get_adapter_for_device(device)
            try:
                if not adapter.connect():
                    self.device_repo.update(device, {"is_online": False, "status": "DISCONNECTED"})
                    continue
                
                self.device_repo.update(device, {"is_online": True, "status": "CONNECTED"})
                
                # Fetch attendance logs
                raw_logs = adapter.get_attendance_logs()
                attendance_logger.info(f"Fetched {len(raw_logs)} raw log entries from device '{device.name}' ({device.ip})")
                
                new_logs_queued = 0
                for rlog in raw_logs:
                    member_id = rlog.get("member_id")
                    timestamp = rlog.get("timestamp")
                    
                    if not member_id or not timestamp:
                        continue
                    
                    # Prevent duplicates
                    if not self.log_repo.check_duplicate(member_id, timestamp):
                        queue_item = AttendanceQueue(
                            member_id=member_id,
                            device_id=device.id,
                            timestamp=timestamp,
                            status="PENDING"
                        )
                        self.log_repo.create(queue_item)
                        new_logs_queued += 1
                        
                attendance_logger.info(f"Successfully queued {new_logs_queued} new logs for device '{device.name}'")
                self.device_repo.update(device, {"last_sync": datetime.datetime.utcnow()})
                
            except Exception as e:
                error_logger.error(f"Error syncing device '{device.name}' ({device.ip}): {e}")
                self.device_repo.update(device, {"is_online": False, "status": "ERROR"})
            finally:
                try:
                    adapter.disconnect()
                except Exception:
                    pass

    def upload_pending_logs(self, cloud_client) -> int:
        """Uploads queued local PENDING logs to the cloud in batches.
        
        Args:
            cloud_client: Instance of CloudClient configured to push logs.
            
        Returns:
            int: Number of logs successfully uploaded.
        """
        pending_items = self.log_repo.get_pending_logs(limit=100)
        if not pending_items:
            return 0
            
        scheduler_logger.info(f"Sync runner: attempting to upload {len(pending_items)} pending logs to cloud...")
        
        # Prepare batch payload
        payload = []
        for item in pending_items:
            payload.append({
                "local_id": item.id,
                "member_id": item.member_id,
                "device_id": item.device_id,
                "timestamp": item.timestamp.isoformat()
            })
            
        try:
            success = cloud_client.upload_attendance(payload)
            if success:
                attendance_logger.info(f"Uploaded batch of {len(pending_items)} logs successfully.")
                
                # Mark as uploaded in DB
                now = datetime.datetime.utcnow()
                for item in pending_items:
                    self.log_repo.update(item, {"status": "UPLOADED", "uploaded_at": now})
                    
                # Track run in history
                self.db.add(SyncHistory(
                    logs_fetched=len(pending_items),
                    logs_uploaded=len(pending_items),
                    status="SUCCESS",
                    details=f"Uploaded batch of {len(pending_items)} logs"
                ))
                self.db.commit()
                return len(pending_items)
            else:
                raise RuntimeError("Cloud client returned upload failure status")
                
        except Exception as e:
            error_logger.error(f"Failed to upload attendance batch: {e}")
            # Increment retry count for failed batch
            for item in pending_items:
                status = "FAILED" if item.retry_count >= 10 else "PENDING"
                self.log_repo.update(item, {"status": status, "retry_count": item.retry_count + 1})
                
            self.db.add(SyncHistory(
                logs_fetched=0,
                logs_uploaded=0,
                status="FAILED",
                details=f"Failed to upload batch of {len(pending_items)}: {e}"
            ))
            self.db.commit()
            return 0
