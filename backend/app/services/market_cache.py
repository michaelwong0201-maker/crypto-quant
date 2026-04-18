"""行情 Redis 缓存 + 网格下单频控（V0.0.7）。"""
from __future__ import annotations

import random
import time
from typing import Optional

import redis.asyncio as redis_async

from app.config import settings

_redis: redis_async.Redis | None = None


async def get_redis() -> redis_async.Redis:
    global _redis
    if _redis is None:
        _redis = redis_async.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def set_spot_last_price(symbol: str, price: str) -> None:
    r = await get_redis()
    sym = symbol.upper().replace("/", "")
    await r.set(f"cq:spot:{sym}:last", price, ex=120)


async def get_spot_last_price(symbol: str) -> Optional[str]:
    r = await get_redis()
    sym = symbol.upper().replace("/", "")
    return await r.get(f"cq:spot:{sym}:last")


async def set_market_ws_alive() -> None:
    r = await get_redis()
    await r.set("cq:market:ws_alive", "1", ex=30)


async def set_user_stream_alive() -> None:
    try:
        r = await get_redis()
        await r.set("cq:user_stream:alive", "1", ex=45)
    except Exception:
        pass


async def user_stream_healthy() -> bool:
    try:
        r = await get_redis()
        return (await r.get("cq:user_stream:alive")) == "1"
    except Exception:
        return False


async def market_stream_healthy() -> bool:
    try:
        r = await get_redis()
        v = await r.get("cq:market:ws_alive")
        return v == "1"
    except Exception:
        return False


async def allow_grid_order_burst(instance_id: int, max_per_60s: int = 36) -> bool:
    """滑动 60s 窗口内下单次数上限。"""
    try:
        r = await get_redis()
        key = f"cq:grid:rl:{instance_id}"
        now = time.time()
        await r.zremrangebyscore(key, 0, now - 60)
        n = await r.zcard(key)
        if n >= max_per_60s:
            return False
        await r.zadd(key, {f"{now}-{random.random()}": now})
        await r.expire(key, 120)
        return True
    except Exception:
        return True
