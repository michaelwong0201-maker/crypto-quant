from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.password_policy import require_password_changed
from app.db.session import get_db
from app.models.order_record import OrderRecord
from app.models.user import User, UserRole
from app.schemas.trading import OrderRecordOut, PlaceOrderRequest
from app.services.trading_exec import execute_order_intent
from app.trading.binance import BinanceTestnetConnector
from app.trading.exchange_base import MarketType, OrderIntent, OrderSide
from app.trading.risk_gateway import RiskRejected

router = APIRouter(prefix="/trading", tags=["trading"])


@router.get("/orders", response_model=list[OrderRecordOut])
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 100,
    offset: int = 0,
    symbol: Optional[str] = None,
    side: Optional[str] = None,
    status: Optional[str] = None,
) -> list[OrderRecord]:
    q = select(OrderRecord).order_by(OrderRecord.id.desc())
    if user.role != UserRole.admin.value:
        q = q.where(OrderRecord.user_id == user.id)
    if symbol:
        q = q.where(OrderRecord.symbol == symbol.upper())
    if side:
        q = q.where(OrderRecord.side == side.upper())
    if status:
        q = q.where(OrderRecord.status == status)
    q = q.offset(offset).limit(min(limit, 500))
    r = await db.execute(q)
    return list(r.scalars().all())


@router.get("/orders/count")
async def order_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    q = select(func.count()).select_from(OrderRecord)
    if user.role != UserRole.admin.value:
        q = q.where(OrderRecord.user_id == user.id)
    total = (await db.execute(q)).scalar_one()
    return {"total": total}


@router.post("/orders", response_model=OrderRecordOut)
async def place_order(
    body: PlaceOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_password_changed)],
) -> OrderRecord:
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Viewers cannot trade")
    side = OrderSide.BUY if body.side == "BUY" else OrderSide.SELL
    mt = MarketType.SPOT if body.market_type == "spot" else MarketType.FUTURES_USDT
    intent = OrderIntent(body.symbol.upper().replace("/", ""), side, body.quantity, mt)
    try:
        return await execute_order_intent(db, user, intent, strategy_instance_id=None)
    except RiskRejected as e:
        raise HTTPException(status_code=400, detail=e.reason) from e


@router.get("/positions")
async def positions(
    user: Annotated[User, Depends(require_password_changed)],
) -> dict:
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        conn = BinanceTestnetConnector()
        spot = await conn.spot_balances()
        fut = await conn.futures_balances()
        spot_pos = [
            {
                "asset": b["asset"],
                "free": b.get("free", "0"),
                "locked": b.get("locked", "0"),
                "total": str(float(b.get("free", 0)) + float(b.get("locked", 0))),
            }
            for b in spot
            if float(b.get("free", 0)) > 0.00001 or float(b.get("locked", 0)) > 0.00001
        ]
        fut_pos = [
            {
                "asset": b.get("asset", ""),
                "balance": b.get("balance", "0"),
                "available": b.get("availableBalance", "0"),
                "unrealized_pnl": b.get("crossUnPnl", "0"),
            }
            for b in fut
            if abs(float(b.get("balance", 0))) > 0.00001
        ]
        return {"spot": spot_pos, "futures": fut_pos}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exchange error: {e}") from e
