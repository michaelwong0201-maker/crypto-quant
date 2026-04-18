"""现货等差网格：全层级限价 + User Stream 成交后补单。"""
from __future__ import annotations

import asyncio
import logging
import re
from decimal import Decimal
from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.models.strategy_instance import StrategyInstance
from app.models.strategy_log import StrategyLog
from app.models.user import User
from app.services.exchange_rules import (
    format_price_for_binance,
    format_qty_for_binance,
    get_symbol_rules,
    snap_grid_level,
)
from app.services.market_cache import get_spot_last_price
from app.services.trading_exec import execute_order_intent
from app.strategy.grid_calculator import arithmetic_grid_prices
from app.trading.binance import BinanceTestnetConnector
from app.trading.exchange_base import MarketType, OrderIntent, OrderSide
from app.trading.fill_events import GridFillEvent, get_fill_queue
from app.trading.risk_gateway import RiskRejected

logger = logging.getLogger(__name__)

_FILL_IDX = re.compile(r"^g\d+([bs])(\d+)(?:n\d+)?$")


def _split_spot_pair(symbol: str) -> tuple[str, str]:
    s = symbol.upper().replace("/", "")
    if s.endswith("USDT"):
        return s[:-4], "USDT"
    if s.endswith("USDC"):
        return s[:-4], "USDC"
    if s.endswith("BUSD"):
        return s[:-4], "BUSD"
    raise ValueError(f"unsupported spot symbol {symbol}")


def _free_bal(balances: list[dict], asset: str) -> Decimal:
    for b in balances:
        if b.get("asset") == asset:
            return Decimal(str(b.get("free", "0")))
    return Decimal("0")


def _grid_cid(instance_id: int, side: str, idx: int) -> str:
    ch = "b" if side.upper() == "BUY" else "s"
    return f"g{instance_id}{ch}{idx}"[:36]


def _parse_fill_level(cid: str) -> tuple[str, int] | None:
    m = _FILL_IDX.match(cid)
    if not m:
        return None
    return m.group(1), int(m.group(2))


async def grid_spot_loop(
    config: dict,
    _on_side: Callable[[OrderSide], Awaitable[None]],
    stop_event: asyncio.Event,
) -> None:
    instance_id = int(config["_instance_id"])
    symbol = str(config.get("symbol", "BTCUSDT")).upper().replace("/", "")
    poll = float(config.get("poll_seconds", 15))
    lower = Decimal(str(config["lowerPrice"]))
    upper = Decimal(str(config["upperPrice"]))
    grid_count = int(config["gridCount"])
    amount_per_grid = Decimal(str(config["amountPerGrid"]))
    max_orders_per_tick = int(config.get("max_orders_per_tick", 12))

    if config.get("market_type", "spot") != "spot":
        logger.error("grid_spot only supports spot")
        return

    base_a, quote_a = _split_spot_pair(symbol)
    levels_template = arithmetic_grid_prices(lower, upper, grid_count)
    conn = BinanceTestnetConnector()
    my_q = get_fill_queue(instance_id)

    while not stop_event.is_set():
        t_stop = asyncio.create_task(stop_event.wait())
        t_fill = asyncio.create_task(my_q.get())
        t_sleep = asyncio.create_task(asyncio.sleep(poll))
        done, pending = await asyncio.wait({t_stop, t_fill, t_sleep}, return_when=asyncio.FIRST_COMPLETED)
        for p in pending:
            p.cancel()
            try:
                await p
            except asyncio.CancelledError:
                pass

        if stop_event.is_set():
            break

        fills: list[GridFillEvent] = []
        if t_fill in done and not t_fill.cancelled():
            try:
                fills.append(t_fill.result())
            except Exception:
                pass
        while True:
            try:
                fills.append(my_q.get_nowait())
            except asyncio.QueueEmpty:
                break

        async with SessionLocal() as session:
            inst = await _load_instance(session, instance_id)
            if inst is None or inst.run_status != "RUNNING":
                break

            try:
                rules = await get_symbol_rules(symbol)
            except Exception as e:
                await _log(session, instance_id, "ERROR", f"exchangeInfo failed: {e}")
                await session.commit()
                continue

            levels: list[Decimal] = []
            for p in levels_template:
                sp = snap_grid_level(p, rules.tick_size)
                if not levels or sp != levels[-1]:
                    levels.append(sp)
            if len(levels) < 2:
                await _log(session, instance_id, "ERROR", "grid levels collapsed after tick rounding")
                await session.commit()
                continue

            price_s = await get_spot_last_price(symbol)
            if not price_s:
                try:
                    t = await conn.spot_ticker_price(symbol)
                    price_s = str(t.get("price", "0"))
                except Exception as e:
                    await _log(session, instance_id, "WARNING", f"ticker failed: {e}")
                    await session.commit()
                    continue

            price = snap_grid_level(Decimal(price_s), rules.tick_size)
            if price < lower or price > upper:
                await _log(
                    session,
                    instance_id,
                    "WARNING",
                    f"price {price} outside grid [{lower},{upper}], not placing",
                )
                await session.commit()
                continue

            targets_buy: set[int] = set()
            targets_sell: set[int] = set()
            for i, lv in enumerate(levels):
                if lv < price:
                    targets_buy.add(i)
                elif lv > price:
                    targets_sell.add(i)

            for ev in fills:
                if ev.symbol.upper().replace("/", "") != symbol:
                    continue
                parsed = _parse_fill_level(ev.client_order_id)
                if not parsed:
                    continue
                ch, idx_f = parsed
                if ev.side == "BUY" and ch == "b":
                    j = idx_f + 1
                    if j < len(levels) and levels[j] > price:
                        targets_sell.add(j)
                elif ev.side == "SELL" and ch == "s":
                    j = idx_f - 1
                    if j >= 0 and levels[j] < price:
                        targets_buy.add(j)

            try:
                open_orders = await conn.spot_open_orders(symbol)
            except Exception as e:
                await _log(session, instance_id, "ERROR", f"openOrders failed: {e}")
                await session.commit()
                continue

            open_cids = {str(o.get("clientOrderId") or "") for o in open_orders}

            try:
                balances = await conn.spot_balances()
            except Exception as e:
                await _log(session, instance_id, "ERROR", f"account balances failed: {e}")
                await session.commit()
                continue

            base_free = _free_bal(balances, base_a)
            quote_free = _free_bal(balances, quote_a)

            r_user = await session.execute(select(User).where(User.id == inst.owner_id))
            owner = r_user.scalar_one()

            orders_placed = 0

            def can_place_more() -> bool:
                return orders_placed < max_orders_per_tick

            for i in sorted(targets_buy):
                if not can_place_more():
                    break
                lv = levels[i]
                qty_raw = amount_per_grid / lv
                qstr = format_qty_for_binance(qty_raw, rules)
                pstr = format_price_for_binance(lv, rules)
                if Decimal(qstr) <= 0:
                    continue
                notional = Decimal(qstr) * Decimal(pstr)
                if notional < rules.min_notional:
                    continue
                if quote_free < notional:
                    continue

                cid = _grid_cid(instance_id, "BUY", i)
                if cid in open_cids:
                    continue

                intent_b = OrderIntent(
                    symbol,
                    OrderSide.BUY,
                    qstr,
                    MarketType.SPOT,
                    order_type="LIMIT",
                    limit_price=pstr,
                    client_order_id=cid,
                    extra={
                        "require_market_stream": True,
                        "require_user_stream": True,
                        "grid_instance_id": instance_id,
                    },
                )
                try:
                    await execute_order_intent(session, owner, intent_b, strategy_instance_id=instance_id)
                    await _log(
                        session,
                        instance_id,
                        "INFO",
                        f"Grid BUY {qstr} @ {pstr}",
                        {"clientOrderId": cid},
                    )
                    open_cids.add(cid)
                    quote_free -= notional
                    orders_placed += 1
                except RiskRejected as e:
                    await _log(session, instance_id, "WARNING", f"BUY blocked: {e.reason}")
                except Exception as e:
                    await _log(session, instance_id, "ERROR", f"BUY failed: {e}")

            remaining_base = base_free
            for i in sorted(targets_sell):
                if not can_place_more():
                    break
                lv = levels[i]
                qty_raw = amount_per_grid / lv
                qstr = format_qty_for_binance(qty_raw, rules)
                pstr = format_price_for_binance(lv, rules)
                qd = Decimal(qstr)
                if qd <= 0:
                    continue
                notional = qd * Decimal(pstr)
                if notional < rules.min_notional:
                    continue
                if qd > remaining_base:
                    continue

                cid = _grid_cid(instance_id, "SELL", i)
                if cid in open_cids:
                    continue

                intent_s = OrderIntent(
                    symbol,
                    OrderSide.SELL,
                    qstr,
                    MarketType.SPOT,
                    order_type="LIMIT",
                    limit_price=pstr,
                    client_order_id=cid,
                    extra={
                        "require_market_stream": True,
                        "require_user_stream": True,
                        "grid_instance_id": instance_id,
                    },
                )
                try:
                    await execute_order_intent(session, owner, intent_s, strategy_instance_id=instance_id)
                    await _log(
                        session,
                        instance_id,
                        "INFO",
                        f"Grid SELL {qstr} @ {pstr}",
                        {"clientOrderId": cid},
                    )
                    open_cids.add(cid)
                    remaining_base -= qd
                    orders_placed += 1
                except RiskRejected as e:
                    await _log(session, instance_id, "WARNING", f"SELL blocked: {e.reason}")
                except Exception as e:
                    await _log(session, instance_id, "ERROR", f"SELL failed: {e}")

            if fills:
                await _log(
                    session,
                    instance_id,
                    "INFO",
                    f"Processed {len(fills)} fill event(s), placed {orders_placed} order(s) this tick",
                )

            await session.commit()


async def _load_instance(session: AsyncSession, instance_id: int) -> StrategyInstance | None:
    r = await session.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id))
    return r.scalar_one_or_none()


async def _log(
    session: AsyncSession,
    instance_id: int,
    level: str,
    message: str,
    data: dict | None = None,
) -> None:
    session.add(
        StrategyLog(
            strategy_instance_id=instance_id,
            level=level,
            message=message,
            data=data,
        )
    )
