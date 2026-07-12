import socket
import ipaddress
import threading
from typing import List, Dict, Any

def get_local_subnet() -> str:
    """Finds the local subnet of the machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Connect to a dummy external IP (doesn't send packet)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        # Assume a standard Class C subnet /24
        ip_network = ipaddress.ip_interface(f"{local_ip}/24").network
        return str(ip_network)
    except Exception:
        return "192.168.1.0/24"

def scan_ip(ip: str, discovered: list):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            # Try to connect to TCP port 4370 (ZKTeco default port)
            result = s.connect_ex((ip, 4370))
            if result == 0:
                discovered.append({
                    "ip": ip,
                    "port": 4370,
                    "vendor": "ZKTeco / eSSL",
                    "model": "Generic Biometric Device",
                    "firmware": "N/A",
                    "mac": "N/A"
                })
    except Exception:
        pass

def discover_lan_devices() -> List[Dict[str, Any]]:
    """Scans the local LAN subnet for biometric devices listening on port 4370."""
    subnet = get_local_subnet()
    network = ipaddress.ip_network(subnet)
    discovered = []
    threads = []
    
    # Scan all hosts in subnet
    for host in network.hosts():
        ip_str = str(host)
        t = threading.Thread(target=scan_ip, args=(ip_str, discovered))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    return discovered
