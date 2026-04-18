"""Binance 现货 exchangeInfo 解析：价格/数量步长与最小名义。"""
from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN
from typing import Any

from app.trading.binance import BinanceTestnetConnector, _get_shared_client, _norm_symbol

_cache: dict[str, tuple[float, "SymbolRules"]] = {}
_TTL = 3600.0


@dataclass
class SymbolRules:
    tick_size: Decimal
    step_size: Decimal
    min_qty: Decimal
    min_notional: Decimal


def _parse_filters(filters: list[dict[str, Any]]) -> SymbolRules:
    tick = Decimal("0.01")
    step = Decimal("0.00001")
    min_qty = Decimal("0")
    min_not = Decimal("10")
    for f in filters:
        ft = f.get("filterType")
        if ft == "PRICE_FILTER":
            tick = Decimal(str(f.get("tickSize", tick)))
        elif ft == "LOT_SIZE":
            step = Decimal(str(f.get("stepSize", step)))
            min_qty = Decimal(str(f.get("minQty", "0")))
        elif ft in ("MIN_NOTIONAL", "NOTIONAL"):
            min_not = Decimal(str(f.get("minNotional", f.get("notional", min_not))))
    return SymbolRules(tick_size=tick, step_size=step, min_qty=min_qty, min_notional=min_not)


async def get_symbol_rules(symbol: str) -> SymbolRules:
    sym = _norm_symbol(symbol)
    now = time.time()
    hit = _cache.get(sym)
    if hit and now - hit[0] < _TTL:
        return hit[1]

    conn = BinanceTestnetConnector()
    base = conn._get_spot_base()
    client = _get_shared_client()
    r = await client.get(f"{base}/api/v3/exchangeInfo", params={"symbol": sym})
    r.raise_for_status()
    data = r.json()
    symbols = data.get("symbols") or []
    if not symbols:
        raise ValueError(f"symbol {sym} not in exchangeInfo")
    s0 = symbols[0]
    rules = _parse_filters(list(s0.get("filters") or []))
    _cache[sym] = (now, rules)
    return rules


def floor_to_step(value: Decimal, step: Decimal) -> Decimal:
    if step <= 0:
        return value
    return (value / step).to_integral_value(rounding=ROUND_DOWN) * step


def format_qty_for_binance(qty: Decimal, rules: SymbolRules) -> str:
    q = floor_to_step(qty, rules.step_size)
    if q < rules.min_qty:
        q = rules.min_qty
    s = str(q.normalize())
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


def format_price_for_binance(price: Decimal, rules: SymbolRules) -> str:
    p = floor_to_step(price, rules.tick_size)
    s = str(p.normalize())
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


def snap_grid_level(p: Decimal, tick: Decimal) -> Decimal:
    return floor_to_step(p, tick)
