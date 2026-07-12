import sys
import threading
from app.database.db import init_db
from app.core.config import ConfigManager
from app.services.cloud.client import CloudClient
from app.scheduler.runner import JobScheduler
from app.utils.logger import scheduler_logger, error_logger

def start_api_server(config_manager: ConfigManager, scheduler: JobScheduler):
    """Launches the local FastAPI diagnostics server on a daemon thread."""
    import uvicorn
    from app.server import app, init_api_services
    
    init_api_services(config_manager, scheduler)
    
    host = config_manager.config.local_server.host
    port = config_manager.config.local_server.port
    
    scheduler_logger.info(f"Local FastAPI Server starting at http://{host}:{port}")
    try:
        uvicorn.run(app, host=host, port=port, log_level="warning")
    except Exception as e:
        error_logger.error(f"Failed to start FastAPI server: {e}")

def main():
    # 1. Initialize SQLite Database
    init_db()
    
    # 2. Load encrypted configuration
    config_manager = ConfigManager()
    
    # 3. Instantiate Cloud Client
    cloud_client = CloudClient(config_manager)
    
    # 4. Initialize & Start Job Scheduler
    scheduler = JobScheduler(cloud_client)
    scheduler.start()
    
    # 5. Spin up FastAPI local API in a background thread
    api_thread = threading.Thread(
        target=start_api_server, 
        args=(config_manager, scheduler), 
        daemon=True
    )
    api_thread.start()
    
    # 6. Check for non-GUI mode (Windows Service or CLI daemon mode)
    if "--service" in sys.argv or "--daemon" in sys.argv:
        scheduler_logger.info("Running in Daemon mode (No GUI). Press Ctrl+C to exit.")
        try:
            # Keep main thread alive
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            scheduler_logger.info("Stopping agent daemon...")
        finally:
            scheduler.stop()
    else:
        # Launch PySide6 GUI window
        from PySide6.QtWidgets import QApplication
        from app.ui.main_window import MainWindow
        
        gui_app = QApplication(sys.argv)
        window = MainWindow(config_manager, scheduler)
        window.show()
        
        exit_code = gui_app.exec()
        scheduler.stop()
        sys.exit(exit_code)

if __name__ == "__main__":
    main()
