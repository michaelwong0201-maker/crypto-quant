"""Binance 现货 User Stream：listenKey + WS，同步 executionReport。"""
from __future__ import annotations

import asyncio
import json
import logging

import websockets

from app.config import settings
from app.services.market_cache import set_user_stream_alive
from app.services.order_sync import apply_execution_report
from app.trading.binance import BinanceTestnetConnector

logger = logging.getLogger(__name__)

_KEEPALIVE_SEC = 15 * 60


async def _keepalive_loop(stop: asyncio.Event, listen_key: str) -> None:
    conn = BinanceTestnetConnector()
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=_KEEPALIVE_SEC)
            return
        except asyncio.TimeoutError:
            pass
        try:
            await conn.spot_keepalive_listen_key(listen_key)
            logger.debug("user stream listenKey keepalive ok")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("listenKey keepalive failed: %s", e)


async def run_spot_user_stream(stop: asyncio.Event) -> None:
    if not settings.binance_user_stream_enabled:
        logger.info("user stream disabled (settings)")
        return
    if not settings.binance_api_key.strip():
        logger.warning("user stream skipped: BINANCE_API_KEY empty")
        return

    conn = BinanceTestnetConnector()
    backoff = 1.0
    ka_task: asyncio.Task[None] | None = None

    while not stop.is_set():
        listen_key = ""
        try:
            listen_key = await conn.spot_create_listen_key()
        except Exception as e:
            logger.warning("user stream create listenKey failed: %s (retry in %ss)", e, backoff)
            try:
                await asyncio.wait_for(stop.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            if stop.is_set():
                break
            backoff = min(backoff * 2, 60.0)
            continue

        backoff = 1.0
        url = conn.spot_user_stream_ws_url(listen_key)
        ka_stop = asyncio.Event()
        ka_task = asyncio.create_task(_keepalive_loop(ka_stop, listen_key))

        try:
            async with websockets.connect(
                url,
                ping_interval=20,
                ping_timeout=60,
                close_timeout=5,
            ) as ws:
                logger.info("user stream ws connected")
                while not stop.is_set():
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=90.0)
                    except asyncio.TimeoutError:
                        logger.warning("user stream recv timeout, reconnecting")
                        break
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    await set_user_stream_alive()
                    if isinstance(data, dict):
                        await apply_execution_report(data)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("user stream error: %s (retry in %ss)", e, backoff)
            try:
                await asyncio.wait_for(stop.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            backoff = min(backoff * 2, 30.0)
        finally:
            ka_stop.set()
            if ka_task is not None:
                ka_task.cancel()
                try:
                    await ka_task
                except asyncio.CancelledError:
                    pass
                ka_task = None

        if stop.is_set():
            break
