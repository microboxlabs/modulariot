from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class HarnessSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MIOT_HARNESS_")

    env: str = "local"
    workspace_dir: Path = Path(".miot-workspace")
    default_tenant_id: str = "demo-tenant"
    default_user_id: str = "demo-user"


@lru_cache(maxsize=1)
def get_settings() -> HarnessSettings:
    return HarnessSettings()

