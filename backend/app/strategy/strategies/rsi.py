import asyncio
import logging
from typing import Awaitable, Callable, Optional

from app.trading.exchange_base import MarketType, OrderSide
from app.trading.binance import BinanceTestnetConnector

logger = logging.getLogger(__name__)


def _rsi(closes: list[float], period: int) -> float:
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent = deltas[-period:]
    gains = [d for d in recent if d > 0]
    losses = [-d for d in recent if d < 0]
    avg_gain = sum(gains) / period if gains else 0.0
    avg_loss = sum(losses) / period if losses else 0.0
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


async def rsi_loop(
    config: dict,
    on_signal: Callable[[str], Awaitable[None]],
    stop_event: asyncio.Event,
) -> None:
    poll = float(config.get("poll_seconds", 60))
    symbol = str(config["symbol"])
    interval = str(config.get("interval", "1m"))
    period = int(config.get("period", 14))
    overbought = float(config.get("overbought", 70))
    oversold = float(config.get("oversold", 30))
    market_type = MarketType.SPOT if config.get("market_type", "spot") == "spot" else MarketType.FUTURES_USDT
    futures = market_type == MarketType.FUTURES_USDT

    conn = BinanceTestnetConnector()
    last_state: Optional[str] = None

    while not stop_event.is_set():
        try:
            klines = await conn.public_klines(symbol, interval, limit=max(period + 50, 120), futures=futures)
            closes = [float(k[4]) for k in klines]
            if len(closes) < period + 2:
                await asyncio.sleep(poll)
                continue

            rsi_now = _rsi(closes, period)
            rsi_prev = _rsi(closes[:-1], period)

            state: Optional[str] = None
            if rsi_prev >= oversold and rsi_now < oversold:
                state = "oversold"
            elif rsi_prev <= overbought and rsi_now > overbought:
                state = "overbought"

            if state and state != last_state:
                if state == "oversold":
                    await on_signal("BUY")
                else:
                    await on_signal("SELL")
                last_state = state
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("rsi tick failed: %s", e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll)
        except asyncio.TimeoutError:
            continue
