from __future__ import annotations
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.order_record import OrderRecord
from app.trading.binance import BinanceTestnetConnector


async def get_portfolio_summary(user_id: Optional[int] = None) -> dict:
    """Get current portfolio from exchange."""
    conn = BinanceTestnetConnector()
    spot = await conn.spot_balances()
    fut = await conn.futures_balances()
    
    spot_nonzero = [b for b in spot if float(b.get("free", 0)) > 0 or float(b.get("locked", 0)) > 0]
    fut_nonzero = [b for b in fut if float(b.get("balance", 0)) != 0]
    
    spot_total = sum(float(b.get("free", 0)) + float(b.get("locked", 0)) for b in spot_nonzero)
    fut_total = sum(float(b.get("balance", 0)) for b in fut_nonzero)
    fut_pnl = sum(float(b.get("crossUnPnl", 0)) for b in fut_nonzero)
    
    allocations = []
    for b in spot_nonzero:
        asset = b.get("asset", "")
        free = float(b.get("free", 0))
        locked = float(b.get("locked", 0))
        total = free + locked
        if total > 0:
            allocations.append({"asset": asset, "amount": total, "type": "spot"})
    for b in fut_nonzero:
        asset = b.get("asset", "")
        bal = float(b.get("balance", 0))
        if bal != 0:
            allocations.append({"asset": asset, "amount": abs(bal), "type": "futures"})
    
    return {
        "spot_balances": spot_nonzero,
        "futures_balances": fut_nonzero,
        "spot_total_estimate": spot_total,
        "futures_total_estimate": fut_total,
        "futures_unrealized_pnl": fut_pnl,
        "total_equity_estimate": spot_total + fut_total,
        "allocations": allocations,
    }


async def save_portfolio_snapshot(db: AsyncSession, user_id: int, summary: dict) -> PortfolioSnapshot:
    snap = PortfolioSnapshot(
        user_id=user_id,
        total_equity_usd=str(summary.get("total_equity_estimate", 0)),
        spot_value_usd=str(summary.get("spot_total_estimate", 0)),
        futures_value_usd=str(summary.get("futures_total_estimate", 0)),
        unrealized_pnl_usd=str(summary.get("futures_unrealized_pnl", 0)),
        snapshot_data=summary.get("allocations"),
    )
    db.add(snap)
    await db.commit()
    await db.refresh(snap)
    return snap


async def get_equity_history(db: AsyncSession, user_id: int, limit: int = 90) -> list[dict]:
    result = await db.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.user_id == user_id)
        .order_by(PortfolioSnapshot.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "time": r.created_at.isoformat(),
            "equity": float(r.total_equity_usd),
            "spot": float(r.spot_value_usd),
            "futures": float(r.futures_value_usd),
            "pnl": float(r.unrealized_pnl_usd),
        }
        for r in reversed(rows)
    ]


async def get_trade_stats(db: AsyncSession, user_id: Optional[int] = None) -> dict:
    """Get trading statistics from order records."""
    q = select(OrderRecord)
    if user_id:
        q = q.where(OrderRecord.user_id == user_id)
    
    result = await db.execute(q)
    orders = result.scalars().all()
    
    total = len(orders)
    submitted = sum(1 for o in orders if o.status == "submitted")
    failed = sum(1 for o in orders if o.status == "failed")
    
    buy_count = sum(1 for o in orders if o.side == "BUY")
    sell_count = sum(1 for o in orders if o.side == "SELL")
    
    return {
        "total_orders": total,
        "submitted": submitted,
        "failed": failed,
        "buy_orders": buy_count,
        "sell_orders": sell_count,
        "success_rate": round(submitted / total * 100, 1) if total > 0 else 0,
    }
