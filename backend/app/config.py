from __future__ import annotations
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[2]


def _read_app_version() -> str:
    try:
        return (_REPO_ROOT / "VERSION").read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0"


APP_VERSION = _read_app_version()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT / ".env", _REPO_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://crypto:crypto@localhost:5432/crypto_quant"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "change-me"

    binance_api_key: str = ""
    binance_api_secret: str = ""
    binance_spot_testnet_base_url: str = "https://testnet.binance.vision"
    binance_futures_testnet_base_url: str = "https://testnet.binancefuture.com"


settings = Settings()
