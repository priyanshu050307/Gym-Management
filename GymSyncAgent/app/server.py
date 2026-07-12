from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database.db import get_db, get_db_dep
from app.core.config import ConfigManager
from app.repositories.device_repo import DeviceRepository
from app.repositories.log_repo import AttendanceQueueRepository
from app.services.sync_service import SyncService
from app.scheduler.runner import JobScheduler
from pathlib import Path

# Attempt to load psutil for telemetry
try:
    import psutil
except ImportError:
    psutil = None

app = FastAPI(title="GymSyncAgent Local API", version="1.0.0")

# Enable CORS for local dashboards or query agents
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config_manager: Optional[ConfigManager] = None
scheduler: Optional[JobScheduler] = None

def init_api_services(cfg_mgr: ConfigManager, sched: JobScheduler):
    """Binds configuration and scheduler instances to the API endpoints."""
    global config_manager, scheduler
    config_manager = cfg_mgr
    scheduler = sched

@app.get("/status")
def get_status(db: Session = Depends(get_db_dep)):
    """Returns general diagnostics of the sync agent."""
    if not config_manager:
        raise HTTPException(status_code=500, detail="Service not initialized")
        
    log_repo = AttendanceQueueRepository(db)
    device_repo = DeviceRepository(db)
    
    total_devices = len(device_repo.get_all())
    online_devices = len(device_repo.get_online_devices())
    pending_queue_count = len(log_repo.get_pending_logs(limit=10000))
    
    cpu_percent = psutil.cpu_percent() if psutil else 0.0
    ram_percent = psutil.virtual_memory().percent if psutil else 0.0
    
    return {
        "status": "RUNNING",
        "agent_version": config_manager.config.agent_version,
        "branch_id": config_manager.config.gym_branch_id,
        "total_devices": total_devices,
        "online_devices": online_devices,
        "pending_queue_count": pending_queue_count,
        "system": {
            "cpu_percent": cpu_percent,
            "ram_percent": ram_percent
        }
    }

@app.get("/devices")
def get_devices(db: Session = Depends(get_db_dep)):
    """Lists all registered biometric devices and their local status."""
    device_repo = DeviceRepository(db)
    devices = device_repo.get_all()
    return {
        "devices": [
            {
                "id": d.id,
                "name": d.name,
                "ip": d.ip,
                "port": d.port,
                "vendor": d.vendor,
                "is_online": d.is_online,
                "status": d.status,
                "last_sync": d.last_sync.isoformat() if d.last_sync else None
            } for d in devices
        ]
    }

@app.post("/sync")
def trigger_manual_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db_dep)):
    """Triggers an out-of-band manual synchronization run in the background."""
    if not scheduler or not scheduler.cloud_client:
        raise HTTPException(status_code=500, detail="Scheduler not running")
        
    def run_sync():
        sync_service = SyncService(db)
        sync_service.sync_all_devices()
        sync_service.upload_pending_logs(scheduler.cloud_client)
        
    background_tasks.add_task(run_sync)
    return {"message": "Manual sync job queued successfully in background"}

@app.get("/logs/{log_type}")
def get_tail_logs(log_type: str, lines: int = 100):
    """Retrieves the last N lines of a specific log file for diagnostics."""
    valid_logs = ["attendance", "device", "cloud", "scheduler", "error"]
    if log_type not in valid_logs:
        raise HTTPException(status_code=400, detail=f"Invalid log type. Choose from: {valid_logs}")
        
    log_file_path = Path("logs") / f"{log_type}.log"
    if not log_file_path.exists():
        return {"logs": []}
        
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            content = f.readlines()
        tail = content[-lines:]
        return {"logs": [line.strip() for line in tail]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")

# ──────────────────────────────────────────────────────────
# VIRTUAL BIOMETRIC SIMULATOR FOR MOBILE TRIAL
# ──────────────────────────────────────────────────────────
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import datetime

class LocalCheckinRequest(BaseModel):
    member_id: str

@app.post("/api/scan-demo/checkin")
def local_virtual_checkin(payload: LocalCheckinRequest, db: Session = Depends(get_db_dep)):
    """Inserts a real-time check-in record directly into the offline queue."""
    from app.models.log_queue import AttendanceQueue
    from app.repositories.device_repo import DeviceRepository
    
    device_repo = DeviceRepository(db)
    devices = device_repo.get_all()
    if not devices:
        raise HTTPException(status_code=400, detail="Please add at least one device in the Desktop UI first.")
        
    device_id = devices[0].id # Pick first device
    
    new_log = AttendanceQueue(
        member_id=payload.member_id,
        device_id=device_id,
        timestamp=datetime.datetime.now(),
        status="PENDING"
    )
    db.add(new_log)
    db.commit()
    return {"message": "Success! Check-in registered locally. It will sync to the cloud shortly."}

@app.get("/scan-demo", response_class=HTMLResponse)
def serve_virtual_scanner():
    """Serves a beautiful biometric scanner simulator page for mobile phones."""
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Virtual Biometric Terminal</title>
        <style>
            body {
                background-color: #0f172a;
                color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                box-sizing: border-box;
            }
            .container {
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 16px;
                padding: 30px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                text-align: center;
                box-sizing: border-box;
            }
            h1 {
                font-size: 22px;
                color: #8b5cf6;
                margin-top: 0;
                margin-bottom: 24px;
            }
            label {
                display: block;
                text-align: left;
                margin-bottom: 8px;
                font-size: 14px;
                color: #94a3b8;
            }
            input {
                width: 100%;
                background-color: #0f172a;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 12px;
                color: #f8fafc;
                font-size: 16px;
                box-sizing: border-box;
                margin-bottom: 24px;
            }
            input:focus {
                outline: none;
                border-color: #8b5cf6;
            }
            .scan-btn {
                background: radial-gradient(circle, #8b5cf6 0%, #7c3aed 100%);
                border: none;
                border-radius: 50%;
                width: 130px;
                height: 130px;
                margin: 10px auto 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 20px 2px rgba(139, 92, 246, 0.4);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .scan-btn:active {
                transform: scale(0.95);
                box-shadow: 0 0 10px 1px rgba(139, 92, 246, 0.2);
            }
            .fingerprint-icon {
                font-size: 50px;
            }
            .status-text {
                font-size: 14px;
                color: #94a3b8;
                min-height: 20px;
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Virtual Biometric Terminal</h1>
            <label for="memberId">Enter Member ID (e.g. member1@gym.com or 1):</label>
            <input type="text" id="memberId" value="1" placeholder="member1@gym.com">
            
            <button class="scan-btn" onclick="triggerScan()">
                <div class="fingerprint-icon">👆</div>
            </button>
            <div style="font-weight: bold; color: #a78bfa; margin-bottom: 10px;">Tap to Scan Fingerprint</div>
            
            <div id="status" class="status-text">Ready to scan...</div>
        </div>

        <script>
            async function triggerScan() {
                const memberId = document.getElementById('memberId').value.trim();
                const statusDiv = document.getElementById('status');
                
                if (!memberId) {
                    statusDiv.innerText = 'Please enter a valid Member ID';
                    statusDiv.style.color = '#ef4444';
                    return;
                }
                
                statusDiv.innerText = 'Scanning fingerprint...';
                statusDiv.style.color = '#a78bfa';
                
                try {
                    const response = await fetch('/api/scan-demo/checkin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ member_id: memberId })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                        statusDiv.innerText = 'Success! Scan saved. Syncing to Cloud...';
                        statusDiv.style.color = '#10b981';
                        setTimeout(() => {
                            statusDiv.innerText = 'Ready to scan...';
                            statusDiv.style.color = '#94a3b8';
                        }, 3000);
                    } else {
                        statusDiv.innerText = data.detail || 'Failed to scan';
                        statusDiv.style.color = '#ef4444';
                    }
                } catch (err) {
                    statusDiv.innerText = 'Network error: ' + err.message;
                    statusDiv.style.color = '#ef4444';
                }
            }
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

