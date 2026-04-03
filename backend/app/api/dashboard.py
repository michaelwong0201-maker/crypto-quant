from __future__ import annotations

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

    oc = (await db.execute(q_orders)).scalar_one()
    sc = (await db.execute(q_strat)).scalar_one()

    rq = select(OrderRecord).order_by(OrderRecord.id.desc()).limit(10)
    if not is_admin:
        rq = rq.where(OrderRecord.user_id == uid)
    recent = list((await db.execute(rq)).scalars().all())

    # Trade stats
    stats = await get_trade_stats(db, None if is_admin else uid)

    # Recent alerts
    alerts_q = select(AlertEvent).order_by(AlertEvent.id.desc()).limit(5)
    alert_rows = list((await db.execute(alerts_q)).scalars().all())

    # Market ticker
    market = {}
    try:
        conn = BinanceTestnetConnector()
        ticker = await conn.spot_ticker_price("BTCUSDT")
        market["btc_price"] = ticker.get("price", "0")
        ticker_eth = await conn.spot_ticker_price("ETHUSDT")
        market["eth_price"] = ticker_eth.get("price", "0")
    except Exception:
        market["btc_price"] = "N/A"
        market["eth_price"] = "N/A"

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
