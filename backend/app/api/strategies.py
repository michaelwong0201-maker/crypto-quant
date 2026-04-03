from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.password_policy import require_password_changed
from app.db.session import SessionLocal, get_db
from app.models.backtest import BacktestRun
from app.models.strategy_instance import StrategyInstance
from app.models.strategy_log import StrategyLog
from app.models.user import User, UserRole
from app.schemas.strategy import StrategyInstanceCreate, StrategyInstanceOut
from app.services.backtest_service import run_backtest
from app.services.trading_exec import execute_order_intent
from app.strategy.engine import engine
from app.strategy.strategies.bollinger import bollinger_loop
from app.strategy.strategies.rsi import rsi_loop
from app.strategy.strategies.simple_ma import simple_ma_loop
from app.trading.exchange_base import MarketType, OrderIntent, OrderSide

router = APIRouter(prefix="/strategies", tags=["strategies"])

STRATEGY_CATALOG = [
    {
        "key": "simple_ma",
        "name": "双均线交叉",
        "description": "快慢均线金叉做多，死叉做空，经典趋势跟踪策略",
        "default_config": {
            "symbol": "BTCUSDT", "market_type": "spot",
            "fast": 7, "slow": 25, "interval": "1m",
            "quantity": "0.001", "poll_seconds": 60,
        },
    },
    {
        "key": "rsi",
        "name": "RSI 超买超卖",
        "description": "RSI低于超卖线买入，高于超买线卖出，适合震荡行情",
        "default_config": {
            "symbol": "BTCUSDT", "market_type": "spot",
            "period": 14, "overbought": 70, "oversold": 30,
            "interval": "1m", "quantity": "0.001", "poll_seconds": 60,
        },
    },
    {
        "key": "bollinger",
        "name": "布林带突破",
        "description": "价格跌破下轨买入，突破上轨卖出，均值回归策略",
        "default_config": {
            "symbol": "BTCUSDT", "market_type": "spot",
            "period": 20, "num_std": 2.0,
            "interval": "1m", "quantity": "0.001", "poll_seconds": 60,
        },
    },
]

STRATEGY_LOOPS = {
    "simple_ma": simple_ma_loop,
    "rsi": rsi_loop,
    "bollinger": bollinger_loop,
}

VALID_KEYS = {s["key"] for s in STRATEGY_CATALOG}


def _merge_config(key: str, cfg: dict[str, Any]) -> dict[str, Any]:
    for s in STRATEGY_CATALOG:
        if s["key"] == key:
            return {**s["default_config"], **cfg}
    return cfg


@router.get("/catalog")
async def catalog(_: Annotated[User, Depends(get_current_user)]) -> list[dict[str, Any]]:
    return STRATEGY_CATALOG


@router.get("", response_model=list[StrategyInstanceOut])
async def list_strategies(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[StrategyInstanceOut]:
    q = select(StrategyInstance).order_by(StrategyInstance.id.desc())
    if user.role != UserRole.admin.value:
        q = q.where(StrategyInstance.owner_id == user.id)
    rows = list((await db.execute(q)).scalars().all())
    return [
        StrategyInstanceOut.model_validate(s, update={"running": engine.is_running(s.id)})
        for s in rows
    ]


@router.post("", response_model=StrategyInstanceOut)
async def create_strategy(
    body: StrategyInstanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StrategyInstanceOut:
    if body.strategy_key not in VALID_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown strategy_key: {body.strategy_key}")
    cfg = _merge_config(body.strategy_key, body.config)
    s = StrategyInstance(
        name=body.name, strategy_key=body.strategy_key,
        config=cfg, owner_id=user.id,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return StrategyInstanceOut.model_validate(s, update={"running": False})


@router.delete("/{instance_id}")
async def delete_strategy(
    instance_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    r = await db.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
    inst = r.scalar_one_or_none()
    if inst is None or not _can_touch(user, inst):
        raise HTTPException(status_code=404, detail="Not found")
    if engine.is_running(instance_id):
        engine.stop(instance_id)
    await db.delete(inst)
    await db.commit()
    return {"status": "deleted"}


def _can_touch(user: User, inst: StrategyInstance) -> bool:
    return user.role == UserRole.admin.value or inst.owner_id == user.id


@router.post("/{instance_id}/start")
async def start_strategy(
    instance_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_password_changed)],
) -> dict[str, str]:
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Viewers cannot start strategies")
    r = await db.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
    inst = r.scalar_one_or_none()
    if inst is None or not _can_touch(user, inst):
        raise HTTPException(status_code=404, detail="Not found")
    if inst.strategy_key not in STRATEGY_LOOPS:
        raise HTTPException(status_code=400, detail="Unsupported strategy")

    cfg = dict(inst.config)
    loop_fn = STRATEGY_LOOPS[inst.strategy_key]

    async def coro_factory(stop_event: Any) -> None:
        from app.models.user import User as UserModel

        async def on_side(side: Any) -> None:
            async with SessionLocal() as session:
                r1 = await session.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
                row = r1.scalar_one()
                r2 = await session.execute(select(UserModel).where(UserModel.id == row.owner_id))
                owner = r2.scalar_one()
                mt = (
                    MarketType.SPOT
                    if str(row.config.get("market_type", "spot")) == "spot"
                    else MarketType.FUTURES_USDT
                )
                order_side = side if isinstance(side, OrderSide) else (OrderSide.BUY if str(side) == "BUY" else OrderSide.SELL)
                intent = OrderIntent(
                    str(row.config["symbol"]), order_side,
                    str(row.config["quantity"]), mt,
                )
                await execute_order_intent(session, owner, intent, strategy_instance_id=instance_id)
                session.add(StrategyLog(
                    strategy_instance_id=instance_id,
                    level="INFO",
                    message=f"Signal {side} executed for {row.config['symbol']}",
                    data={"side": str(side), "symbol": row.config["symbol"]},
                ))
                await session.commit()

        await loop_fn(cfg, on_side, stop_event)

    engine.start(instance_id, coro_factory)
    return {"status": "started"}


@router.post("/{instance_id}/stop")
async def stop_strategy(
    instance_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    r = await db.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
    inst = r.scalar_one_or_none()
    if inst is None or not _can_touch(user, inst):
        raise HTTPException(status_code=404, detail="Not found")
    if user.role == UserRole.viewer.value:
        raise HTTPException(status_code=403, detail="Viewers cannot stop strategies")
    engine.stop(instance_id)
    return {"status": "stopped"}


@router.get("/{instance_id}/logs")
async def strategy_logs(
    instance_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 50,
) -> list[dict]:
    r = await db.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
    inst = r.scalar_one_or_none()
    if inst is None or not _can_touch(user, inst):
        raise HTTPException(status_code=404, detail="Not found")
    logs = await db.execute(
        select(StrategyLog)
        .where(StrategyLog.strategy_instance_id == instance_id)
        .order_by(StrategyLog.id.desc())
        .limit(limit)
    )
    return [
        {
            "id": l.id, "level": l.level, "message": l.message,
            "data": l.data,
            "created_at": l.created_at.isoformat() if l.created_at else "",
        }
        for l in logs.scalars().all()
    ]


class BacktestRequest(BaseModel):
    strategy_key: str = "simple_ma"
    symbol: str = "BTCUSDT"
    interval: str = "1h"
    market_type: str = "spot"
    config: dict[str, Any] = Field(default_factory=dict)
    initial_capital: float = 10000.0
    limit: int = 500


@router.post("/backtest")
async def run_backtest_endpoint(
    body: BacktestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    if body.strategy_key not in VALID_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {body.strategy_key}")

    cfg = _merge_config(body.strategy_key, body.config)
    try:
        result = await run_backtest(
            body.strategy_key, body.symbol, body.interval,
            cfg, body.initial_capital, body.limit, body.market_type,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    bt = BacktestRun(
        user_id=user.id, strategy_key=body.strategy_key,
        symbol=body.symbol, interval=body.interval,
        config=cfg, start_time="", end_time="",
        initial_capital=str(body.initial_capital),
        final_capital=str(result.get("final_capital", 0)),
        total_return_pct=str(result.get("total_return_pct", 0)),
        max_drawdown_pct=str(result.get("max_drawdown_pct", 0)),
        win_rate=str(result.get("win_rate", 0)),
        total_trades=result.get("total_trades", 0),
        sharpe_ratio=str(result.get("sharpe_ratio", 0)),
        trades_json=result.get("trades"),
        equity_curve_json=result.get("equity_curve"),
        status=result.get("status", "completed"),
    )
    db.add(bt)
    await db.commit()
    await db.refresh(bt)

    return {
        "id": bt.id,
        **result,
    }


@router.get("/backtest/history")
async def backtest_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 20,
) -> list[dict]:
    q = select(BacktestRun).order_by(BacktestRun.id.desc()).limit(limit)
    if user.role != UserRole.admin.value:
        q = q.where(BacktestRun.user_id == user.id)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": r.id,
            "strategy_key": r.strategy_key,
            "symbol": r.symbol,
            "interval": r.interval,
            "initial_capital": float(r.initial_capital) if r.initial_capital else 0,
            "final_capital": float(r.final_capital) if r.final_capital else 0,
            "total_return_pct": float(r.total_return_pct) if r.total_return_pct else 0,
            "max_drawdown_pct": float(r.max_drawdown_pct) if r.max_drawdown_pct else 0,
            "win_rate": float(r.win_rate) if r.win_rate else 0,
            "total_trades": r.total_trades or 0,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
