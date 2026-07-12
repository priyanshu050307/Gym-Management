import os
import json
from pathlib import Path
from typing import Any, Dict
from pydantic import BaseModel, Field
from app.core.security import encrypt_data, decrypt_data

CONFIG_FILE_PATH = Path("config.json")

class CloudConfig(BaseModel):
    base_url: str = "http://localhost:5005"
    api_key: str = ""
    jwt_token: str = ""
    refresh_token: str = ""

class LocalServerConfig(BaseModel):
    port: int = 8080
    host: str = "0.0.0.0"

class AgentConfig(BaseModel):
    cloud: CloudConfig = Field(default_factory=CloudConfig)
    local_server: LocalServerConfig = Field(default_factory=LocalServerConfig)
    gym_branch_id: str = ""
    agent_version: str = "1.0.0"

class ConfigManager:
    """Manages loading, saving, and encrypting local agent configurations."""
    
    def __init__(self, file_path: Path = CONFIG_FILE_PATH):
        self.file_path = file_path
        self._config: AgentConfig = AgentConfig()
        self.load()

    @property
    def config(self) -> AgentConfig:
        return self._config

    def load(self) -> None:
        """Loads configuration from local JSON, decrypting sensitive values."""
        if not self.file_path.exists():
            self._config = AgentConfig()
            self.save()
            return
        
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Decrypt sensitive fields
            cloud_data = data.get("cloud", {})
            if cloud_data.get("jwt_token"):
                cloud_data["jwt_token"] = decrypt_data(cloud_data["jwt_token"])
            if cloud_data.get("refresh_token"):
                cloud_data["refresh_token"] = decrypt_data(cloud_data["refresh_token"])
            if cloud_data.get("api_key"):
                cloud_data["api_key"] = decrypt_data(cloud_data["api_key"])
                
            self._config = AgentConfig(**data)
        except Exception as e:
            # If load fails (e.g. invalid json or decryption error), use default config
            self._config = AgentConfig()

    def save(self) -> None:
        """Saves current configuration to local JSON, encrypting sensitive values."""
        try:
            # Convert to dictionary representation
            data = self._config.model_dump()
            
            # Encrypt sensitive fields
            cloud_data = data.get("cloud", {})
            if cloud_data.get("jwt_token"):
                cloud_data["jwt_token"] = encrypt_data(cloud_data["jwt_token"])
            if cloud_data.get("refresh_token"):
                cloud_data["refresh_token"] = encrypt_data(cloud_data["refresh_token"])
            if cloud_data.get("api_key"):
                cloud_data["api_key"] = encrypt_data(cloud_data["api_key"])
                
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            raise RuntimeError(f"Failed to save configuration: {e}")

    def update_cloud_credentials(self, jwt_token: str = None, refresh_token: str = None, api_key: str = None) -> None:
        """Updates and encrypts cloud connection credentials."""
        if jwt_token is not None:
            self._config.cloud.jwt_token = jwt_token
        if refresh_token is not None:
            self._config.cloud.refresh_token = refresh_token
        if api_key is not None:
            self._config.cloud.api_key = api_key
        self.save()
