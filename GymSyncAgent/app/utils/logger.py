import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# Format for logging
LOG_FORMAT = "%(asctime)s [%(levelname)s] (%(name)s) %(message)s"

def setup_logger(name: str, log_file: str, level=logging.INFO) -> logging.Logger:
    """Configures a custom rotating file logger.
    
    Args:
        name: Logger name.
        log_file: Name of the file inside /logs directory.
        level: Minimum log level.
        
    Returns:
        logging.Logger: The configured logger instance.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid duplicate handlers if setup is called multiple times
    if logger.hasHandlers():
        logger.handlers.clear()
        
    file_path = LOG_DIR / log_file
    
    # Rotate logs at 10MB, keeping 5 backup copies
    file_handler = RotatingFileHandler(
        file_path, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(file_handler)
    
    # Add console output for debug/terminal monitoring
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(console_handler)
    
    return logger

# Pre-defined loggers for different modules
attendance_logger = setup_logger("attendance", "attendance.log")
device_logger = setup_logger("device", "device.log")
cloud_logger = setup_logger("cloud", "cloud.log")
scheduler_logger = setup_logger("scheduler", "scheduler.log")
error_logger = setup_logger("error", "error.log", logging.ERROR)
