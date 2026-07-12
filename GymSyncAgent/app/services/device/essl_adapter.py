from app.services.device.zk_adapter import ZKTecoAdapter

class ESSLAdapter(ZKTecoAdapter):
    """eSSL devices use the same underlying ZK SDK socket protocols."""
    
    def get_device_info(self) -> dict:
        info = super().get_device_info()
        info["vendor"] = "eSSL"
        return info
