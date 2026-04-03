from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone
from typing import Annotated, Any

import redis.asyncio as redis
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import APP_VERSION, settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.order_record import OrderRecord
from app.models.strategy_instance import StrategyInstance
from app.models.user import User, UserRole
from app.strategy.engine import engine
from app.trading.binance import BinanceTestnetConnector

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status")
async def status(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    if user.role == UserRole.viewer.value:
        return {"role": "viewer", "detail": "limited", "version": APP_VERSION}

    db_ok = False
    db_latency = 0
    try:
        import time as _t
        t0 = _t.monotonic()
        await db.execute(text("SELECT 1"))
        db_latency = round((_t.monotonic() - t0) * 1000, 1)
        db_ok = True
    except Exception:
        pass

    redis_ok = False
    redis_latency = 0
    try:
        import time as _t
        r = redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
        t0 = _t.monotonic()
        await r.ping()
        redis_latency = round((_t.monotonic() - t0) * 1000, 1)
        redis_ok = True
        await r.aclose()
    except Exception:
        pass

    keys_ok = bool(settings.binance_api_key and settings.binance_api_secret)
    exchange_ping: dict[str, Any] = {"configured": keys_ok}
    if keys_ok:
        try:
            c = BinanceTestnetConnector()
            await c.spot_ticker_price("BTCUSDT")
            exchange_ping["spot_public"] = True
        except Exception as e:
            exchange_ping["spot_public_error"] = str(e)

    # Running strategies
    strategy_count = (await db.execute(select(func.count()).select_from(StrategyInstance))).scalar_one()
    order_count = (await db.execute(select(func.count()).select_from(OrderRecord))).scalar_one()

    return {
        "version": APP_VERSION,
        "app_env": settings.app_env,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "database": {"connected": db_ok, "latency_ms": db_latency},
        "redis": {"connected": redis_ok, "latency_ms": redis_latency},
        "exchange": exchange_ping,
        "strategies": {
            "total_instances": strategy_count,
            "running": engine.running_count(),
        },
        "orders": {"total": order_count},
    }


@router.get("/audit-logs")
async def audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, le=200),
) -> list[dict]:
    rows = (
        await db.execute(
            select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "action": r.action,
            "detail": r.detail,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
