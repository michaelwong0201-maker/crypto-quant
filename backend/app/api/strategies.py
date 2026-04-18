from __future__ import annotations

import asyncio
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
from app.services.grid_orders import cancel_grid_orders_for_instance
from app.strategy.engine import engine
from app.strategy.strategies.bollinger import bollinger_loop
from app.strategy.strategies.grid_spot import grid_spot_loop
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
    {
        "key": "grid_spot",
        "name": "BTC 现货等差网格",
        "description": "现货全层级限价网格 + User Stream 成交补单（验收环境：Binance 测试网）",
        "default_config": {
            "symbol": "BTCUSDT",
            "market_type": "spot",
            "lowerPrice": "80000",
            "upperPrice": "100000",
            "gridCount": 10,
            "amountPerGrid": "15",
            "poll_seconds": 15,
            "max_orders_per_tick": 12,
        },
    },
]

STRATEGY_LOOPS = {
    "simple_ma": simple_ma_loop,
    "rsi": rsi_loop,
    "bollinger": bollinger_loop,
    "grid_spot": grid_spot_loop,
}

VALID_KEYS = {s["key"] for s in STRATEGY_CATALOG}


def _safe_float(x: Any) -> float:
    if x is None:
        return 0.0
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


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
        StrategyInstanceOut.model_validate(s).model_copy(
            update={
                "running": engine.is_running(s.id),
                "run_status": getattr(s, "run_status", "CREATED"),
            },
        )
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
    await db.refresh(s)
    return StrategyInstanceOut.model_validate(s).model_copy(update={"running": False})


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
    if inst.strategy_key == "grid_spot":
        await asyncio.sleep(0.25)
        await cancel_grid_orders_for_instance(instance_id, str(inst.config.get("symbol", "BTCUSDT")))
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

    inst.run_status = "RUNNING"
    inst.last_error = None
    await db.commit()

    cfg = dict(inst.config)
    cfg["_instance_id"] = instance_id
    loop_fn = STRATEGY_LOOPS[inst.strategy_key]

    async def coro_factory(stop_event: Any) -> None:
        from app.models.user import User as UserModel

        async def on_side(side: Any) -> None:
            async with SessionLocal() as session:
                r1 = await session.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
                row = r1.scalar_one()
                r2 = await session.execute(select(UserModel).where(UserModel.id == row.owner_id))
                owner = r2.scalar_one()
                mt = MarketType.SPOT
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
    if inst.strategy_key == "grid_spot":
        await asyncio.sleep(0.35)
        await cancel_grid_orders_for_instance(instance_id, str(inst.config.get("symbol", "BTCUSDT")))
    inst.run_status = "STOPPED"
    await db.commit()
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
    if body.strategy_key == "grid_spot":
        raise HTTPException(status_code=400, detail="Grid strategy has no backtest in V0.0.7")

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
            "initial_capital": _safe_float(r.initial_capital),
            "final_capital": _safe_float(r.final_capital),
            "total_return_pct": _safe_float(r.total_return_pct),
            "max_drawdown_pct": _safe_float(r.max_drawdown_pct),
            "win_rate": _safe_float(r.win_rate),
            "total_trades": int(r.total_trades or 0),
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
