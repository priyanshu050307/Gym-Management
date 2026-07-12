import unittest
import datetime
from app.services.device.mock_adapter import MockAdapter

class TestDeviceAdapters(unittest.TestCase):
    def test_mock_adapter_flow(self):
        adapter = MockAdapter(ip="127.0.0.1")
        self.assertFalse(adapter.connected)
        
        # Test connection
        self.assertTrue(adapter.connect())
        self.assertTrue(adapter.connected)
        
        # Test info retrieval
        info = adapter.get_device_info()
        self.assertEqual(info["vendor"], "MockVendor")
        
        # Test user CRUD
        self.assertTrue(adapter.add_user("10", "Alice Smith", "9090"))
        self.assertEqual(adapter.users["10"]["name"], "Alice Smith")
        
        self.assertTrue(adapter.update_user("10", "Alice Johnson", "9090"))
        self.assertEqual(adapter.users["10"]["name"], "Alice Johnson")
        
        self.assertTrue(adapter.delete_user("10"))
        self.assertNotIn("10", adapter.users)
