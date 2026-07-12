from apscheduler.schedulers.background import BackgroundScheduler
from app.database.db import get_db
from app.services.sync_service import SyncService
from app.utils.logger import scheduler_logger, error_logger

class JobScheduler:
    """Manages background cron loops for syncing logs, heartbeat, and polling commands."""
    
    def __init__(self, cloud_client):
        self.cloud_client = cloud_client
        self.scheduler = BackgroundScheduler()
        self.is_running = False

    def _sync_job(self) -> None:
        """Executes the attendance pull and upload sync cycle."""
        with get_db() as db:
            try:
                sync_service = SyncService(db)
                # 1. Pull new raw logs from ZK/ESSL devices
                sync_service.sync_all_devices()
                # 2. Upload pending logs to cloud
                sync_service.upload_pending_logs(self.cloud_client)
            except Exception as e:
                error_logger.error(f"Error executing sync job: {e}")

    def _heartbeat_job(self) -> None:
        """Sends the health metrics of this agent and online devices to the SaaS."""
        with get_db() as db:
            try:
                self.cloud_client.send_heartbeat(db)
            except Exception as e:
                error_logger.error(f"Error executing heartbeat job: {e}")

    def _command_polling_job(self) -> None:
        """Polls remote command queues from cloud to execute locally."""
        with get_db() as db:
            try:
                self.cloud_client.poll_and_execute_commands(db)
            except Exception as e:
                error_logger.error(f"Error executing command polling job: {e}")

    def start(self) -> None:
        """Starts the background scheduler loop."""
        if self.is_running:
            return
            
        scheduler_logger.info("Starting background scheduler runner...")
        
        # 1. Attendance sync: runs every 20 seconds
        self.scheduler.add_job(self._sync_job, "interval", seconds=20, id="attendance_sync")
        
        # 2. Heartbeat: runs every 60 seconds
        self.scheduler.add_job(self._heartbeat_job, "interval", seconds=60, id="agent_heartbeat")
        
        # 3. Command Polling: runs every 10 seconds
        self.scheduler.add_job(self._command_polling_job, "interval", seconds=10, id="command_polling")
        
        self.scheduler.start()
        self.is_running = True
        scheduler_logger.info("Background scheduler successfully started.")

    def stop(self) -> None:
        """Stops the background scheduler loop."""
        if not self.is_running:
            return
            
        scheduler_logger.info("Stopping background scheduler...")
        self.scheduler.shutdown()
        self.is_running = False
        scheduler_logger.info("Background scheduler stopped.")
