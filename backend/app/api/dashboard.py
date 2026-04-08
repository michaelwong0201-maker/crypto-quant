from __future__ import annotations

import asyncio
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.alert import AlertEvent
from app.models.order_record import OrderRecord
from app.models.strategy_instance import StrategyInstance
from app.models.user import User, UserRole
from app.services.portfolio_service import get_trade_stats
from app.strategy.engine import engine
from app.trading.binance import BinanceTestnetConnector

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _fetch_market_tickers() -> dict[str, str]:
    """Fetch BTC & ETH prices concurrently with a short timeout."""
    try:
        conn = BinanceTestnetConnector()
        btc_task = conn.spot_ticker_price("BTCUSDT")
        eth_task = conn.spot_ticker_price("ETHUSDT")
        btc, eth = await asyncio.wait_for(
            asyncio.gather(btc_task, eth_task), timeout=5.0
        )
        return {"btc_price": btc.get("price", "0"), "eth_price": eth.get("price", "0")}
    except Exception:
        return {"btc_price": "N/A", "eth_price": "N/A"}


@router.get("/overview")
async def overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    is_admin = user.role == UserRole.admin.value
    uid = user.id

    q_orders = select(func.count()).select_from(OrderRecord)
    q_strat = select(func.count()).select_from(StrategyInstance)
    if not is_admin:
        q_orders = q_orders.where(OrderRecord.user_id == uid)
        q_strat = q_strat.where(StrategyInstance.owner_id == uid)

    rq = select(OrderRecord).order_by(OrderRecord.id.desc()).limit(10)
    if not is_admin:
        rq = rq.where(OrderRecord.user_id == uid)

    alerts_q = select(AlertEvent).order_by(AlertEvent.id.desc()).limit(5)

    # Run all DB queries concurrently (single session, but interleaved I/O)
    oc_fut = db.execute(q_orders)
    sc_fut = db.execute(q_strat)
    recent_fut = db.execute(rq)
    stats_fut = get_trade_stats(db, None if is_admin else uid)
    alerts_fut = db.execute(alerts_q)

    # Binance API runs fully in parallel with DB work
    market_fut = _fetch_market_tickers()

    oc_res, sc_res, recent_res, stats, alerts_res, market = await asyncio.gather(
        oc_fut, sc_fut, recent_fut, stats_fut, alerts_fut, market_fut
    )

    oc = oc_res.scalar_one()
    sc = sc_res.scalar_one()
    recent = list(recent_res.scalars().all())
    alert_rows = list(alerts_res.scalars().all())

    return {
        "order_count": oc,
        "strategy_instance_count": sc,
        "running_strategies": engine.running_count(),
        "trade_stats": stats,
        "market": market,
        "recent_orders": [
            {
                "id": o.id,
                "symbol": o.symbol,
                "side": o.side,
                "quantity": o.quantity,
                "status": o.status,
                "created_at": o.created_at.isoformat() if o.created_at else "",
            }
            for o in recent
        ],
        "recent_alerts": [
            {
                "id": a.id,
                "level": a.level,
                "title": a.title,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in alert_rows
        ],
    }
