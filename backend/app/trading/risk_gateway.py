from __future__ import annotations
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk_settings import RiskSettings
from app.trading.exchange_base import MarketType, OrderIntent
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
    try:
        if intent.market_type == MarketType.FUTURES_USDT:
            px_data = await connector.futures_mark_price(sym)
            price = Decimal(str(px_data.get("markPrice", "0")))
        else:
            px_data = await connector.spot_ticker_price(sym)
            price = Decimal(str(px_data.get("price", "0")))
    except Exception:
        price = Decimal("0")

    qty = Decimal(str(intent.quantity))
    notional = qty * price
    if price > 0 and notional > max_notional:
        raise RiskRejected(f"Order notional {notional} exceeds cap {max_notional} USD")
