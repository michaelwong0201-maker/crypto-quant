from __future__ import annotations
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk_settings import RiskSettings
from app.trading.exchange_base import OrderIntent
from app.trading.binance import BinanceTestnetConnector


class RiskRejected(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


async def ensure_risk_allows(db: AsyncSession, intent: OrderIntent, connector: BinanceTestnetConnector) -> None:
    row = await db.execute(select(RiskSettings).order_by(RiskSettings.id).limit(1))
    settings_row = row.scalar_one_or_none()
    if settings_row is None or not settings_row.trading_enabled:
        raise RiskRejected("Trading disabled in risk settings")

    max_notional = Decimal(str(settings_row.max_order_notional_usd))
    sym = intent.symbol.replace("/", "").upper()
    if intent.order_type == "LIMIT" and intent.limit_price:
        price = Decimal(str(intent.limit_price))
    else:
        try:
            px_data = await connector.spot_ticker_price(sym)
            price = Decimal(str(px_data.get("price", "0")))
        except Exception:
            price = Decimal("0")

    qty = Decimal(str(intent.quantity))
    notional = qty * price
    if price > 0 and notional > max_notional:
        raise RiskRejected(f"Order notional {notional} exceeds cap {max_notional} USD")

    extra = intent.extra or {}
    if extra.get("require_market_stream"):
        from app.services.market_cache import market_stream_healthy

        if not await market_stream_healthy():
            raise RiskRejected("Market WebSocket stream not healthy (see Redis cq:market:ws_alive); grid orders blocked")

    if extra.get("require_user_stream"):
        from app.services.market_cache import user_stream_healthy

        if not await user_stream_healthy():
            raise RiskRejected("User stream not healthy (executionReport WS); grid orders blocked")

    if extra.get("grid_instance_id") is not None:
        from app.services.market_cache import allow_grid_order_burst

        gid = int(extra["grid_instance_id"])
        if not await allow_grid_order_burst(gid):
            raise RiskRejected("Grid order rate limit exceeded (max 36 orders per 60s per strategy)")
