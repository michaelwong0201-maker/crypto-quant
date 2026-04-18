from __future__ import annotations
from pathlib import Path
from typing import Literal

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
    # 兼容旧配置：未设置 BINANCE_SPOT_TRADING_ENV 时，true=testnet / false=live
    binance_use_testnet: bool = True
    # testnet | demo | live — demo=现货模拟交易，见 https://developers.binance.com/docs/binance-spot-api-docs/demo-mode/general-info
    binance_spot_trading_env: str = ""
    # 非空则覆盖现货 REST 根地址（高级）
    binance_spot_rest_base_override: str = ""
    binance_spot_testnet_base_url: str = "https://testnet.binance.vision"
    binance_spot_demo_base_url: str = "https://demo-api.binance.com"
    binance_spot_live_base_url: str = "https://api.binance.com"
    # 行情 WS（现货 miniTicker）；可覆盖
    binance_spot_ws_url_override: str = ""
    binance_spot_ws_testnet: str = "wss://stream.testnet.binance.vision/ws/btcusdt@miniTicker"
    binance_spot_ws_demo: str = "wss://demo-stream.binance.com:9443/ws/btcusdt@miniTicker"
    binance_spot_ws_live: str = "wss://stream.binance.com:9443/ws/btcusdt@miniTicker"
    binance_market_stream_enabled: bool = True
    # 现货成交流 User Stream（listenKey + WS executionReport）
    binance_user_stream_enabled: bool = True
    binance_spot_user_stream_ws_testnet: str = "wss://stream.testnet.binance.vision/ws"
    binance_spot_user_stream_ws_demo: str = "wss://demo-stream.binance.com:9443/ws"
    binance_spot_user_stream_ws_live: str = "wss://stream.binance.com:9443/ws"

    def spot_trading_env(self) -> Literal["testnet", "demo", "live"]:
        v = (self.binance_spot_trading_env or "").strip().lower()
        if v in ("testnet", "demo", "live"):
            return v  # type: ignore[return-value]
        return "testnet" if self.binance_use_testnet else "live"


settings = Settings()
