"""Binance 现货 miniTicker WebSocket → Redis（测试网/生产由配置决定）。"""
from __future__ import annotations

import asyncio
import json
import logging

import websockets

from app.config import settings
from app.services.market_cache import set_market_ws_alive, set_spot_last_price
from app.trading.binance import BinanceTestnetConnector

logger = logging.getLogger(__name__)


async def run_spot_mini_ticker_stream(stop: asyncio.Event) -> None:
    if not settings.binance_market_stream_enabled:
        logger.info("market stream disabled (settings)")
        return
    conn = BinanceTestnetConnector()
    url = conn.spot_ws_url()
    backoff = 1.0
    while not stop.is_set():
        try:
            async with websockets.connect(
                url,
                ping_interval=20,
                ping_timeout=60,
                close_timeout=5,
            ) as ws:
                backoff = 1.0
                logger.info("market ws connected: %s", url)
                while not stop.is_set():
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=90.0)
                    except asyncio.TimeoutError:
                        logger.warning("market ws recv timeout, reconnecting")
                        break
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    c = data.get("c")
                    sym = data.get("s")
                    if c and sym:
                        await set_spot_last_price(sym, str(c))
                        await set_market_ws_alive()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("market ws error: %s (retry in %ss)", e, backoff)
            try:
                await asyncio.wait_for(stop.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            if stop.is_set():
                break
            backoff = min(backoff * 2, 30.0)
