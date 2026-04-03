from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.password_policy import require_password_changed
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.portfolio_service import (
    get_equity_history,
    get_portfolio_summary,
    get_trade_stats,
    save_portfolio_snapshot,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/summary")
async def summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_password_changed)],
) -> dict[str, Any]:
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        data = await get_portfolio_summary(user.id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exchange error: {e}") from e
    return data


@router.get("/balances")
async def balances(
    user: Annotated[User, Depends(require_password_changed)],
) -> dict[str, Any]:
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        data = await get_portfolio_summary(user.id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exchange error: {e}") from e
    return {
        "spot": data["spot_balances"],
        "futures_usdt": data["futures_balances"],
    }


@router.get("/equity-history")
async def equity_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 90,
) -> list[dict]:
    return await get_equity_history(db, user.id, limit)


@router.post("/snapshot")
async def take_snapshot(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_password_changed)],
) -> dict[str, Any]:
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    try:
        summary_data = await get_portfolio_summary(user.id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exchange error: {e}") from e
    snap = await save_portfolio_snapshot(db, user.id, summary_data)
    return {"id": snap.id, "created_at": snap.created_at.isoformat()}


@router.get("/trade-stats")
async def trade_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    is_admin = user.role == UserRole.admin.value
    return await get_trade_stats(db, None if is_admin else user.id)
