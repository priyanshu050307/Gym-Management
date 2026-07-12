from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import datetime

class DeviceAdapter(ABC):
    """Abstract Base Class defining the interface for all biometric device adapters."""
    
    @abstractmethod
    def connect(self) -> bool:
        """Establishes connection to the biometric device.
        
        Returns:
            bool: True if connection is successful, False otherwise.
        """
        pass
        
    @abstractmethod
    def disconnect(self) -> None:
        """Closes connection to the biometric device."""
        pass
        
    @abstractmethod
    def get_device_info(self) -> Dict[str, Any]:
        """Retrieves device hardware, firmware, and vendor specifications.
        
        Returns:
            Dict[str, Any]: Device info dictionary.
        """
        pass
        
    @abstractmethod
    def get_attendance_logs(self) -> List[Dict[str, Any]]:
        """Fetches raw attendance log records from the device storage.
        
        Each log dict should contain keys: 'member_id', 'timestamp'.
        
        Returns:
            List[Dict[str, Any]]: List of attendance records.
        """
        pass
        
    @abstractmethod
    def add_user(self, user_id: str, name: str, card_number: Optional[str] = None, fingerprint: Optional[str] = None) -> bool:
        """Registers a new user profile on the device biometric index."""
        pass
        
    @abstractmethod
    def delete_user(self, user_id: str) -> bool:
        """Deletes a user profile from the device index."""
        pass
        
    @abstractmethod
    def update_user(self, user_id: str, name: str, card_number: Optional[str] = None) -> bool:
        """Updates user profile data on the device."""
        pass
        
    @abstractmethod
    def sync_time(self, dt: datetime.datetime) -> bool:
        """Synchronizes the internal clock of the device with the provided datetime."""
        pass
        
    @abstractmethod
    def restart_device(self) -> bool:
        """Restarts the physical biometric device."""
        pass
        
    @abstractmethod
    def clear_logs(self) -> bool:
        """Wipes the attendance log storage on the device."""
        pass
