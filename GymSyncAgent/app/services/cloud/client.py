import time
import datetime
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.core.config import ConfigManager
from app.utils.logger import cloud_logger, error_logger
from app.repositories.log_repo import AttendanceQueueRepository
from app.repositories.device_repo import DeviceRepository

class CloudClient:
    """Manages secure REST API communication with the Gym Management SaaS cloud."""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.client = httpx.Client(timeout=10.0)

    @property
    def base_url(self) -> str:
        return self.config_manager.config.cloud.base_url

    @property
    def headers(self) -> Dict[str, str]:
        token = self.config_manager.config.cloud.jwt_token
        headers = {
            "Content-Type": "application/json",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _request(self, method: str, path: str, json_data: Any = None) -> httpx.Response:
        """Sends an HTTP request, automatically handling 401 token refresh retries.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            path: Target endpoint path.
            json_data: Optional JSON payload.
            
        Returns:
            httpx.Response: The HTTP response.
        """
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        
        try:
            # 1. Attempt original request
            response = self.client.request(method, url, json=json_data, headers=self.headers)
            
            # 2. Handle unauthorized error (Token expired)
            if response.status_code == 401:
                cloud_logger.warn("Received 401 Unauthorized from cloud. Attempting token refresh...")
                if self._refresh_access_token():
                    # Retry with new token
                    cloud_logger.info("Token refreshed successfully. Retrying request...")
                    response = self.client.request(method, url, json=json_data, headers=self.headers)
                    
            return response
            
        except httpx.RequestError as e:
            cloud_logger.error(f"Network request failed for {url}: {e}")
            raise

    def _refresh_access_token(self) -> bool:
        """Attempts to obtain a new JWT access token using the refresh token."""
        refresh_token = self.config_manager.config.cloud.refresh_token
        if not refresh_token:
            cloud_logger.error("Refresh token is missing. Automatic authentication refresh aborted.")
            return False
            
        url = f"{self.base_url.rstrip('/')}/api/auth/token/refresh"
        try:
            response = self.client.post(url, json={"refresh_token": refresh_token})
            if response.status_code == 200:
                data = response.json()
                new_jwt = data.get("jwt_token")
                new_refresh = data.get("refresh_token", refresh_token)
                
                # Save new credentials securely
                self.config_manager.update_cloud_credentials(jwt_token=new_jwt, refresh_token=new_refresh)
                cloud_logger.info("Saved refreshed cloud credentials successfully.")
                return True
            else:
                cloud_logger.error(f"Token refresh request failed with code {response.status_code}")
                return False
        except Exception as e:
            cloud_logger.error(f"Exception raised during token refresh: {e}")
            return False

    def upload_attendance(self, logs: List[Dict[str, Any]]) -> bool:
        """Uploads a batch of attendance logs to the SaaS cloud.
        
        Args:
            logs: List of parsed logs to upload.
            
        Returns:
            bool: True if batch upload was successful, False otherwise.
        """
        try:
            cloud_logger.info(f"Sending batch upload of {len(logs)} logs to cloud...")
            response = self._request("POST", "/api/sync/attendance", json_data={"logs": logs})
            
            if response.status_code in (200, 201):
                cloud_logger.info("Batch upload of attendance logs succeeded.")
                return True
            else:
                cloud_logger.error(f"Attendance upload failed with status code: {response.status_code}")
                return False
        except Exception as e:
            cloud_logger.error(f"Error in upload_attendance: {e}")
            return False

    def send_heartbeat(self, db: Session) -> bool:
        """Sends telemetry metrics and agent health statistics to the cloud."""
        try:
            # Gather CPU and Memory statistics
            import psutil
            cpu_percent = psutil.cpu_percent()
            ram_percent = psutil.virtual_memory().percent
        except Exception:
            # Fallback if psutil is not available
            cpu_percent = 0.0
            ram_percent = 0.0

        # Query local database for stats
        log_repo = AttendanceQueueRepository(db)
        pending_count = len(log_repo.get_pending_logs(limit=1000))
        
        payload = {
            "cpu_load": cpu_percent,
            "ram_usage": ram_percent,
            "agent_version": self.config_manager.config.agent_version,
            "branch_id": self.config_manager.config.gym_branch_id,
            "pending_queue_count": pending_count,
            "timestamp": time.time()
        }
        
        try:
            cloud_logger.info("Sending heartbeat telemetry to cloud...")
            response = self._request("POST", "/api/sync/heartbeat", json_data=payload)
            if response.status_code == 200:
                cloud_logger.info("Heartbeat telemetry accepted by cloud.")
                return True
            else:
                cloud_logger.error(f"Heartbeat rejected with status: {response.status_code}")
                return False
        except Exception as e:
            cloud_logger.error(f"Heartbeat request failed: {e}")
            return False

    def poll_and_execute_commands(self, db: Session) -> None:
        """Fetches pending commands from cloud, executes them, and reports outcomes."""
        branch_id = self.config_manager.config.gym_branch_id
        if not branch_id:
            cloud_logger.warn("Skipping command polling: branch ID is not configured.")
            return

        try:
            response = self._request("GET", f"/api/sync/commands?branch_id={branch_id}")
            if response.status_code != 200:
                cloud_logger.error(f"Command polling failed with status code {response.status_code}")
                return
                
            commands = response.json().get("commands", [])
            if not commands:
                return
                
            cloud_logger.info(f"Retrieved {len(commands)} commands from cloud. Executing...")
            
            from app.repositories.command_repo import CommandRepository
            from app.models.command import Command
            import json

            cmd_repo = CommandRepository(db)
            device_repo = DeviceRepository(db)
            
            for cmd_data in commands:
                cmd_id = cmd_data.get("id")
                action = cmd_data.get("action")
                payload_str = json.dumps(cmd_data.get("payload", {}))
                
                # 1. Save command locally to keep track of execution log
                local_cmd = cmd_repo.get(cmd_id)
                if not local_cmd:
                    local_cmd = Command(id=cmd_id, action=action, payload=payload_str, status="PENDING")
                    cmd_repo.create(local_cmd)
                
                # 2. Execute command
                success, error_msg = self._run_single_command(db, action, cmd_data.get("payload", {}), device_repo)
                
                # 3. Update local database status
                status = "EXECUTED" if success else "FAILED"
                cmd_repo.update(local_cmd, {
                    "status": status,
                    "error_message": error_msg,
                    "executed_at": datetime.datetime.utcnow()
                })
                
                # 4. Report outcome back to cloud
                self._report_command_status(cmd_id, status, error_msg)
                
        except Exception as e:
            cloud_logger.error(f"Error in command polling/execution loop: {e}")

    def _run_single_command(self, db: Session, action: str, payload: Dict[str, Any], device_repo: DeviceRepository) -> tuple[bool, Optional[str]]:
        """Handles the actual hardware execution of a single command."""
        try:
            from app.services.sync_service import get_adapter_for_device
            
            device_id = payload.get("device_id")
            if not device_id:
                return False, "Missing device_id in payload"
                
            device = device_repo.get(device_id)
            if not device:
                return False, f"Device with ID {device_id} not found locally"
                
            adapter = get_adapter_for_device(device)
            if not adapter.connect():
                return False, f"Failed to connect to device '{device.name}' at {device.ip}"
                
            try:
                if action == "ADD_MEMBER":
                    user_id = str(payload.get("user_id"))
                    name = payload.get("name", "Gym Member")
                    card = payload.get("card_number")
                    fingerprint = payload.get("fingerprint")
                    res = adapter.add_user(user_id, name, card, fingerprint)
                    if res:
                        # Update local users cache
                        from app.models.user import UserCache
                        from app.repositories.base import BaseRepository
                        user_repo = BaseRepository(UserCache, db)
                        existing_user = user_repo.get(user_id)
                        if existing_user:
                            user_repo.update(existing_user, {"name": name, "card_number": card, "fingerprint_template": fingerprint})
                        else:
                            user_repo.create(UserCache(id=user_id, name=name, card_number=card, fingerprint_template=fingerprint))
                    return res, None if res else "Adapter failed to register user profile"
                    
                elif action == "DELETE_MEMBER":
                    user_id = str(payload.get("user_id"))
                    res = adapter.delete_user(user_id)
                    if res:
                        from app.models.user import UserCache
                        from app.repositories.base import BaseRepository
                        user_repo = BaseRepository(UserCache, db)
                        user_repo.delete(user_id)
                    return res, None if res else "Adapter failed to delete user profile"
                    
                elif action == "SYNC_TIME":
                    res = adapter.sync_time(datetime.datetime.now())
                    return res, None if res else "Adapter failed to sync time"
                    
                elif action == "RESTART_DEVICE":
                    res = adapter.restart_device()
                    return res, None if res else "Adapter failed to restart device"
                    
                else:
                    return False, f"Unsupported command action: {action}"
            finally:
                adapter.disconnect()
                
        except Exception as e:
            error_logger.error(f"Command execution error: {e}")
            return False, str(e)

    def _report_command_status(self, cmd_id: str, status: str, error_message: Optional[str] = None) -> None:
        """Sends execution outcome status back to the cloud."""
        url = f"/api/sync/commands/{cmd_id}/response"
        payload = {
            "status": status,
            "error_message": error_message
        }
        try:
            response = self._request("POST", url, json_data=payload)
            if response.status_code == 200:
                cloud_logger.info(f"Command {cmd_id} response reported to cloud as {status}.")
            else:
                cloud_logger.error(f"Failed to report command {cmd_id} outcome: status code {response.status_code}")
        except Exception as e:
            cloud_logger.error(f"Error sending command response: {e}")
