import asyncio
import logging
from statistics import mean
from typing import Awaitable, Callable, Optional

from app.trading.exchange_base import MarketType, OrderSide
from app.trading.binance import BinanceTestnetConnector

logger = logging.getLogger(__name__)


def _ma(closes: list[float], n: int) -> float:
    return mean(closes[-n:])


async def simple_ma_loop(
    config: dict,
    on_side: Callable[[OrderSide], Awaitable[None]],
    stop_event: asyncio.Event,
) -> None:
    poll = float(config.get("poll_seconds", 60))
    symbol = str(config["symbol"])
    interval = str(config.get("interval", "1m"))
    fast = int(config["fast"])
    slow = int(config["slow"])
    market_type = MarketType.SPOT if config.get("market_type", "spot") == "spot" else MarketType.FUTURES_USDT
    futures = market_type == MarketType.FUTURES_USDT

    conn = BinanceTestnetConnector()
    last_state: Optional[str] = None

    while not stop_event.is_set():
        try:
            klines = await conn.public_klines(symbol, interval, limit=max(slow + 50, 120), futures=futures)
            closes = [float(k[4]) for k in klines]
            if len(closes) < slow + 2:
                await asyncio.sleep(poll)
                continue
            f_now = _ma(closes, fast)
            s_now = _ma(closes, slow)
            f_prev = _ma(closes[:-1], fast)
            s_prev = _ma(closes[:-1], slow)
            state: Optional[str] = None
            if f_prev <= s_prev and f_now > s_now:
                state = "gold"
            elif f_prev >= s_prev and f_now < s_now:
                state = "death"
            if state and state != last_state:
                if state == "gold":
                    await on_side(OrderSide.BUY)
                else:
                    await on_side(OrderSide.SELL)
                last_state = state
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("simple_ma tick failed: %s", e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll)
        except asyncio.TimeoutError:
            continue
