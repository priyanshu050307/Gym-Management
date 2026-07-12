import sys
import os
import win32serviceutil
import win32service
import win32event
import servicemanager
import socket
import threading
import time

# Ensure dependencies are inside the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.db import init_db
from app.core.config import ConfigManager
from app.services.cloud.client import CloudClient
from app.scheduler.runner import JobScheduler

class GymSyncAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "GymSyncAgent"
    _svc_display_name_ = "Gym Biometric Sync Agent"
    _svc_description_ = "Synchronizes attendance and user profiles between local biometric devices and Gym Management SaaS."

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.is_running = True

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        self.is_running = False

    def SvcDoRun(self):
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )
        self.main()

    def main(self):
        init_db()
        config_manager = ConfigManager()
        cloud_client = CloudClient(config_manager)
        
        # Start Scheduler
        scheduler = JobScheduler(cloud_client)
        scheduler.start()
        
        # Start Local API Server
        import uvicorn
        from app.server import app, init_api_services
        init_api_services(config_manager, scheduler)
        
        # Run FastAPI in a helper daemon thread
        api_thread = threading.Thread(
            target=lambda: uvicorn.run(
                app, 
                host=config_manager.config.local_server.host, 
                port=config_manager.config.local_server.port, 
                log_level="warning"
            ),
            daemon=True
        )
        api_thread.start()

        # Service loop keepalive
        while self.is_running:
            # Check event stop
            rc = win32event.WaitForSingleObject(self.hWaitStop, 1000)
            if rc == win32event.WAIT_OBJECT_0:
                break
                
        scheduler.stop()

if __name__ == '__main__':
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(GymSyncAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(GymSyncAgentService)
