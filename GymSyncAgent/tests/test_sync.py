import unittest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import Base
from app.models.device import Device
from app.models.log_queue import AttendanceQueue
from app.repositories.device_repo import DeviceRepository
from app.repositories.log_repo import AttendanceQueueRepository
from app.services.sync_service import SyncService

class DummyCloudClient:
    def __init__(self, fail=False):
        self.fail = fail
        self.uploaded_payloads = []

    def upload_attendance(self, payload):
        if self.fail:
            return False
        self.uploaded_payloads.extend(payload)
        return True

class TestSyncService(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        TestingSessionLocal = sessionmaker(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = TestingSessionLocal()
        
        self.device_repo = DeviceRepository(self.db)
        self.log_repo = AttendanceQueueRepository(self.db)
        self.sync_service = SyncService(self.db)
        
        # Register a mock device
        self.device_repo.create(Device(
            id="mock_device_1", name="Test Device", ip="127.0.0.1", vendor="mock", branch_id="branch_A"
        ))

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_sync_pulls_logs_to_queue(self):
        # Initial queue should be empty
        pending = self.log_repo.get_pending_logs()
        self.assertEqual(len(pending), 0)
        
        # Sync devices
        self.sync_service.sync_all_devices()
        
        # Verify raw mock logs got queued locally as PENDING
        pending = self.log_repo.get_pending_logs()
        self.assertGreater(len(pending), 0)
        for item in pending:
            self.assertEqual(item.status, "PENDING")

    def test_upload_success_marks_db(self):
        self.sync_service.sync_all_devices()
        pending = self.log_repo.get_pending_logs()
        
        client = DummyCloudClient(fail=False)
        uploaded_count = self.sync_service.upload_pending_logs(client)
        
        self.assertEqual(uploaded_count, len(pending))
        # Verify local db status updated
        for item in pending:
            self.assertEqual(item.status, "UPLOADED")

    def test_upload_failure_increments_retry(self):
        self.sync_service.sync_all_devices()
        pending = self.log_repo.get_pending_logs()
        
        client = DummyCloudClient(fail=True)
        uploaded_count = self.sync_service.upload_pending_logs(client)
        
        self.assertEqual(uploaded_count, 0)
        # Verify local db status remains PENDING but retry count incremented
        for item in pending:
            self.assertEqual(item.status, "PENDING")
            self.assertEqual(item.retry_count, 1)
