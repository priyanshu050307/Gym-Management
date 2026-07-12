import unittest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.db import Base
from app.models.device import Device
from app.models.log_queue import AttendanceQueue
from app.repositories.device_repo import DeviceRepository
from app.repositories.log_repo import AttendanceQueueRepository

class TestRepositories(unittest.TestCase):
    def setUp(self):
        # Create an in-memory SQLite database for testing
        self.engine = create_engine("sqlite:///:memory:")
        TestingSessionLocal = sessionmaker(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = TestingSessionLocal()
        
        self.device_repo = DeviceRepository(self.db)
        self.log_repo = AttendanceQueueRepository(self.db)

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_create_and_get_device(self):
        dev = Device(id="mac_123", name="Front Door", ip="192.168.1.50", branch_id="branch_1")
        self.device_repo.create(dev)
        
        fetched = self.device_repo.get("mac_123")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.name, "Front Door")
        self.assertEqual(fetched.is_online, False)

    def test_duplicate_prevention(self):
        now = datetime.datetime.utcnow()
        log1 = AttendanceQueue(member_id="member_A", device_id="mac_123", timestamp=now, status="PENDING")
        self.log_repo.create(log1)
        
        # Checking duplicate should return True for same member and timestamp
        self.assertTrue(self.log_repo.check_duplicate("member_A", now))
        # Checking duplicate should return False for different member or timestamp
        self.assertFalse(self.log_repo.check_duplicate("member_B", now))
