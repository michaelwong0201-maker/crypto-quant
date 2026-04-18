import asyncio
import logging
from statistics import mean, stdev
from typing import Awaitable, Callable, Optional

from app.trading.exchange_base import OrderSide
from app.trading.binance import BinanceTestnetConnector

logger = logging.getLogger(__name__)


def _bands(closes: list[float], period: int, num_std: float) -> tuple[float, float, float]:
    window = closes[-period:]
    middle = mean(window)
    sd = stdev(window) if len(window) > 1 else 0.0
    return middle - num_std * sd, middle, middle + num_std * sd


async def bollinger_loop(
    config: dict,
    on_signal: Callable[[str], Awaitable[None]],
    stop_event: asyncio.Event,
) -> None:
    poll = float(config.get("poll_seconds", 60))
    symbol = str(config["symbol"])
    interval = str(config.get("interval", "1m"))
    period = int(config.get("period", 20))
    num_std = float(config.get("num_std", 2.0))
    conn = BinanceTestnetConnector()
    last_state: Optional[str] = None

    while not stop_event.is_set():
        try:
            klines = await conn.public_klines(symbol, interval, limit=max(period + 50, 120))
            closes = [float(k[4]) for k in klines]
            if len(closes) < period + 2:
                await asyncio.sleep(poll)
                continue

            price_now = closes[-1]
            price_prev = closes[-2]
            lower_now, _, upper_now = _bands(closes[:-1], period, num_std)
            lower_prev, _, upper_prev = _bands(closes[:-2], period, num_std)

            state: Optional[str] = None
            if price_prev >= lower_prev and price_now < lower_now:
                state = "below_lower"
            elif price_prev <= upper_prev and price_now > upper_now:
                state = "above_upper"

            if state and state != last_state:
                if state == "below_lower":
                    await on_signal("BUY")
                else:
                    await on_signal("SELL")
                last_state = state
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("bollinger tick failed: %s", e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll)
        except asyncio.TimeoutError:
            continue
