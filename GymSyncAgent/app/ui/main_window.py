import sys
import datetime
from pathlib import Path
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QTabWidget,
    QPushButton, QLabel, QLineEdit, QComboBox, QTextEdit, QTableWidget,
    QTableWidgetItem, QHeaderView, QFormLayout, QMessageBox, QCheckBox,
    QDialog
)
from PySide6.QtCore import QTimer, Qt, QThread, Signal
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.core.config import ConfigManager
from app.repositories.device_repo import DeviceRepository
from app.repositories.log_repo import AttendanceQueueRepository
from app.models.device import Device
from app.services.device.discovery import discover_lan_devices
from app.services.sync_service import SyncService

QSS_STYLE = """
QMainWindow {
    background-color: #0f172a;
}
QWidget {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #f8fafc;
}
QTabWidget::pane {
    border: 1px solid #1e293b;
    background-color: #0f172a;
    border-radius: 8px;
}
QTabBar::tab {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    padding: 8px 16px;
    font-weight: bold;
    color: #94a3b8;
}
QTabBar::tab:selected {
    background-color: #8b5cf6;
    color: #f8fafc;
    border-color: #8b5cf6;
}
QPushButton {
    background-color: #8b5cf6;
    color: #f8fafc;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: bold;
}
QPushButton:hover {
    background-color: #a78bfa;
}
QPushButton:pressed {
    background-color: #7c3aed;
}
QLineEdit, QComboBox, QTextEdit {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 8px;
    color: #f8fafc;
}
QLineEdit:focus, QComboBox:focus, QTextEdit:focus {
    border-color: #8b5cf6;
}
QTableWidget {
    background-color: #1e293b;
    border: 1px solid #334155;
    gridline-color: #334155;
    border-radius: 8px;
}
QHeaderView::section {
    background-color: #0f172a;
    color: #94a3b8;
    padding: 8px;
    border: 1px solid #334155;
    font-weight: bold;
}
QTableWidget::item {
    padding: 6px;
}
QLabel {
    font-size: 13px;
}
"""

class DiscoveryThread(QThread):
    """Worker thread to run LAN network discovery without blocking the GUI."""
    finished_discovery = Signal(list)

    def run(self):
        devices = discover_lan_devices()
        self.finished_discovery.emit(devices)

class MainWindow(QMainWindow):
    def __init__(self, config_manager: ConfigManager, scheduler):
        super().__init__()
        self.config_manager = config_manager
        self.scheduler = scheduler
        
        self.setWindowTitle("GymSyncAgent — SaaS Biometric Bridge")
        self.resize(850, 600)
        self.setStyleSheet(QSS_STYLE)
        
        # Tabs initialization
        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)
        
        self.init_dashboard_tab()
        self.init_devices_tab()
        self.init_cloud_tab()
        self.init_logs_tab()
        self.init_settings_tab()
        
        # Timers for auto-refresh GUI components
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.update_metrics)
        self.refresh_timer.start(5000)  # Update metrics every 5 seconds
        
        # Background Discovery Thread
        self.discovery_thread = DiscoveryThread()
        self.discovery_thread.finished_discovery.connect(self.on_discovery_complete)

    # ──────────────────────────────────────────────────────────
    # TAB: DASHBOARD OVERVIEW
    # ──────────────────────────────────────────────────────────
    def init_dashboard_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Header banner
        header = QLabel("GymSyncAgent Local System Dashboard")
        header.setStyleSheet("font-size: 20px; font-weight: bold; color: #8b5cf6; margin-bottom: 10px;")
        layout.addWidget(header)
        
        # Grid layout for summary stats
        grid_layout = QHBoxLayout()
        
        self.lbl_active_devices = QLabel("Devices Online: 0 / 0")
        self.lbl_active_devices.setStyleSheet("background-color: #1e293b; padding: 20px; border-radius: 8px; font-size: 15px; font-weight: bold;")
        
        self.lbl_queue_size = QLabel("Offline Queue Size: 0 logs")
        self.lbl_queue_size.setStyleSheet("background-color: #1e293b; padding: 20px; border-radius: 8px; font-size: 15px; font-weight: bold;")
        
        self.lbl_internet = QLabel("Internet Status: Connecting...")
        self.lbl_internet.setStyleSheet("background-color: #1e293b; padding: 20px; border-radius: 8px; font-size: 15px; font-weight: bold;")
        
        grid_layout.addWidget(self.lbl_active_devices)
        grid_layout.addWidget(self.lbl_queue_size)
        grid_layout.addWidget(self.lbl_internet)
        layout.addLayout(grid_layout)
        
        # Manual action panel
        btn_layout = QHBoxLayout()
        btn_sync = QPushButton("Sync Database Now")
        btn_sync.clicked.connect(self.trigger_manual_sync)
        btn_layout.addWidget(btn_sync)
        layout.addLayout(btn_layout)
        
        layout.addStretch()
        self.tabs.addTab(tab, "Overview")
        self.update_metrics()

    def update_metrics(self):
        """Fetches live DB and system metrics to update dashboard indicators."""
        with get_db() as db:
            log_repo = AttendanceQueueRepository(db)
            device_repo = DeviceRepository(db)
            
            devices = device_repo.get_all()
            online_count = len(device_repo.get_online_devices())
            pending_count = len(log_repo.get_pending_logs(limit=10000))
            
            self.lbl_active_devices.setText(f"Devices Online: {online_count} / {len(devices)}")
            self.lbl_queue_size.setText(f"Offline Queue Size: {pending_count} logs")
            
            # Simple internet check
            import urllib.request
            try:
                urllib.request.urlopen("https://www.google.com", timeout=2)
                self.lbl_internet.setText("Internet Status: ONLINE")
                self.lbl_internet.setStyleSheet("background-color: #1e293b; padding: 20px; border-radius: 8px; font-size: 15px; font-weight: bold; color: #10b981;")
            except Exception:
                self.lbl_internet.setText("Internet Status: OFFLINE")
                self.lbl_internet.setStyleSheet("background-color: #1e293b; padding: 20px; border-radius: 8px; font-size: 15px; font-weight: bold; color: #ef4444;")
            
            # Reload device grid
            if hasattr(self, 'device_table'):
                self.load_device_table()

    def trigger_manual_sync(self):
        if not self.scheduler or not self.scheduler.cloud_client:
            QMessageBox.critical(self, "Error", "Scheduler or cloud client not initialized.")
            return
            
        with get_db() as db:
            sync_service = SyncService(db)
            sync_service.sync_all_devices()
            sync_service.upload_pending_logs(self.scheduler.cloud_client)
            
        QMessageBox.information(self, "Sync Complete", "Manual sync cycle completed successfully.")
        self.update_metrics()

    # ──────────────────────────────────────────────────────────
    # TAB: DEVICE MANAGEMENT & DISCOVERY
    # ──────────────────────────────────────────────────────────
    def init_devices_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Top action bar
        action_layout = QHBoxLayout()
        btn_discover = QPushButton("Scan LAN Subnet")
        btn_discover.clicked.connect(self.start_lan_discovery)
        
        btn_add = QPushButton("Add Manual IP")
        btn_add.clicked.connect(self.show_add_device_dialog)
        
        action_layout.addWidget(btn_discover)
        action_layout.addWidget(btn_add)
        action_layout.addStretch()
        layout.addLayout(action_layout)
        
        # Devices table
        self.device_table = QTableWidget(0, 7)
        self.device_table.setHorizontalHeaderLabels([
            "ID/MAC", "Device Name", "IP Address", "Port", "Vendor", "Status", "Actions"
        ])
        self.device_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(self.device_table)
        
        self.load_device_table()
        self.tabs.addTab(tab, "Devices")

    def load_device_table(self):
        self.device_table.setRowCount(0)
        with get_db() as db:
            device_repo = DeviceRepository(db)
            devices = device_repo.get_all()
            
            for row_idx, device in enumerate(devices):
                self.device_table.insertRow(row_idx)
                self.device_table.setItem(row_idx, 0, QTableWidgetItem(device.id))
                self.device_table.setItem(row_idx, 1, QTableWidgetItem(device.name))
                self.device_table.setItem(row_idx, 2, QTableWidgetItem(device.ip))
                self.device_table.setItem(row_idx, 3, QTableWidgetItem(str(device.port)))
                self.device_table.setItem(row_idx, 4, QTableWidgetItem(device.vendor))
                
                status_item = QTableWidgetItem(device.status)
                if device.is_online:
                    status_item.setForeground(Qt.green)
                else:
                    status_item.setForeground(Qt.red)
                self.device_table.setItem(row_idx, 5, QTableWidgetItem(status_item))
                
                # Delete action button
                btn_del = QPushButton("Delete")
                btn_del.setStyleSheet("background-color: #ef4444; color: white;")
                btn_del.clicked.connect(lambda _, d_id=device.id: self.delete_device(d_id))
                self.device_table.setCellWidget(row_idx, 6, btn_del)

    def delete_device(self, device_id: str):
        if QMessageBox.question(self, "Confirm Delete", "Remove this device from config?", QMessageBox.Yes | QMessageBox.No) == QMessageBox.Yes:
            with get_db() as db:
                device_repo = DeviceRepository(db)
                device_repo.delete(device_id)
            self.load_device_table()
            self.update_metrics()

    def start_lan_discovery(self):
        self.statusBar().showMessage("Scanning LAN subnet for port 4370 biometric devices...")
        self.discovery_thread.start()

    def on_discovery_complete(self, devices):
        self.statusBar().showMessage("LAN Scan complete.")
        if not devices:
            QMessageBox.information(self, "Discovery", "No biometric devices found in subnet.")
            return
            
        for dev in devices:
            # Auto-save discovered devices to local SQLite db
            with get_db() as db:
                device_repo = DeviceRepository(db)
                # Use IP as temporary ID if MAC is N/A
                dev_id = dev["ip"].replace(".", "_")
                existing = device_repo.get(dev_id)
                if not existing:
                    device_repo.create(Device(
                        id=dev_id,
                        name=f"Discovered ZK ({dev['ip']})",
                        ip=dev["ip"],
                        port=dev["port"],
                        vendor=dev["vendor"],
                        branch_id=self.config_manager.config.gym_branch_id or "default"
                    ))
        self.load_device_table()
        self.update_metrics()

    def show_add_device_dialog(self):
        # Quick inline popup form dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("Add Manual Device")
        dialog.setStyleSheet(QSS_STYLE)
        dialog.resize(300, 250)
        
        form = QFormLayout(dialog)
        
        name_input = QLineEdit()
        ip_input = QLineEdit()
        port_input = QLineEdit("4370")
        vendor_combo = QComboBox()
        vendor_combo.addItems(["ZKTECO", "ESSL", "MOCK"])
        
        form.addRow("Device Name:", name_input)
        form.addRow("IP Address:", ip_input)
        form.addRow("Port:", port_input)
        form.addRow("Vendor Type:", vendor_combo)
        
        btn_save = QPushButton("Save Device")
        form.addRow(btn_save)
        
        def save():
            name = name_input.text().strip()
            ip = ip_input.text().strip()
            port = port_input.text().strip()
            vendor = vendor_combo.currentText()
            
            if not name or not ip or not port.isdigit():
                QMessageBox.warning(dialog, "Warning", "Please enter valid fields.")
                return
                
            dev_id = ip.replace(".", "_")
            with get_db() as db:
                device_repo = DeviceRepository(db)
                device_repo.create(Device(
                    id=dev_id,
                    name=name,
                    ip=ip,
                    port=int(port),
                    vendor=vendor,
                    branch_id=self.config_manager.config.gym_branch_id or "default"
                ))
            dialog.accept()
            self.load_device_table()
            self.update_metrics()
            
        btn_save.clicked.connect(save)
        dialog.exec()

    # ──────────────────────────────────────────────────────────
    # TAB: CLOUD INTEGRATION STATUS
    # ──────────────────────────────────────────────────────────
    def init_cloud_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        header = QLabel("Cloud Synchronization Settings")
        header.setStyleSheet("font-size: 16px; font-weight: bold; color: #8b5cf6;")
        layout.addWidget(header)
        
        form = QFormLayout()
        self.input_url = QLineEdit(self.config_manager.config.cloud.base_url)
        self.input_api_key = QLineEdit(self.config_manager.config.cloud.api_key)
        self.input_api_key.setEchoMode(QLineEdit.Password)
        
        form.addRow("Cloud Base URL:", self.input_url)
        form.addRow("API Key:", self.input_api_key)
        layout.addLayout(form)
        
        btn_save = QPushButton("Save & Authenticate Cloud")
        btn_save.clicked.connect(self.save_cloud_settings)
        layout.addWidget(btn_save)
        
        layout.addStretch()
        self.tabs.addTab(tab, "Cloud Connection")

    def save_cloud_settings(self):
        self.config_manager.config.cloud.base_url = self.input_url.text().strip()
        self.config_manager.config.cloud.api_key = self.input_api_key.text().strip()
        self.config_manager.save()
        QMessageBox.information(self, "Config Saved", "Cloud configuration details securely saved and encrypted using DPAPI.")

    # ──────────────────────────────────────────────────────────
    # TAB: Real-Time Diagnostic LOGS VIEWER
    # ──────────────────────────────────────────────────────────
    def init_logs_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Selector bar
        selector_layout = QHBoxLayout()
        selector_layout.addWidget(QLabel("Log Category:"))
        
        self.log_combo = QComboBox()
        self.log_combo.addItems(["attendance", "device", "cloud", "scheduler", "error"])
        self.log_combo.currentIndexChanged.connect(self.refresh_logs_view)
        selector_layout.addWidget(self.log_combo)
        
        btn_refresh = QPushButton("Refresh Logs")
        btn_refresh.clicked.connect(self.refresh_logs_view)
        selector_layout.addWidget(btn_refresh)
        
        selector_layout.addStretch()
        layout.addLayout(selector_layout)
        
        # Logs text console panel
        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        self.log_console.setStyleSheet("font-family: 'Consolas', monospace; font-size: 11px; background-color: #0f172a;")
        layout.addWidget(self.log_console)
        
        self.refresh_logs_view()
        self.tabs.addTab(tab, "Logs Console")

    def refresh_logs_view(self):
        log_type = self.log_combo.currentText()
        log_path = Path("logs") / f"{log_type}.log"
        if not log_path.exists():
            self.log_console.setText("Log file empty or not initialized yet.")
            return
            
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            # Show only last 150 lines
            tail = lines[-150:]
            self.log_console.setText("".join(tail))
            # Scroll to bottom
            self.log_console.verticalScrollBar().setValue(self.log_console.verticalScrollBar().maximum())
        except Exception as e:
            self.log_console.setText(f"Failed to read log stream: {e}")

    # ──────────────────────────────────────────────────────────
    # TAB: LOCAL SYSTEM SETTINGS
    # ──────────────────────────────────────────────────────────
    def init_settings_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        header = QLabel("Local Agent Service Configurations")
        header.setStyleSheet("font-size: 16px; font-weight: bold; color: #8b5cf6;")
        layout.addWidget(header)
        
        form = QFormLayout()
        self.input_branch = QLineEdit(self.config_manager.config.gym_branch_id)
        self.input_port = QLineEdit(str(self.config_manager.config.local_server.port))
        
        form.addRow("Gym Branch ID Assignment:", self.input_branch)
        form.addRow("Local API Host Port:", self.input_port)
        layout.addLayout(form)
        
        btn_save = QPushButton("Apply System Settings")
        btn_save.clicked.connect(self.save_local_settings)
        layout.addWidget(btn_save)
        
        layout.addStretch()
        self.tabs.addTab(tab, "Settings")

    def save_local_settings(self):
        branch = self.input_branch.text().strip()
        port = self.input_port.text().strip()
        
        if not branch or not port.isdigit():
            QMessageBox.warning(self, "Invalid Inputs", "Please verify configurations.")
            return
            
        self.config_manager.config.gym_branch_id = branch
        self.config_manager.config.local_server.port = int(port)
        self.config_manager.save()
        QMessageBox.information(self, "Settings Applied", "Agent system configurations updated successfully.")
