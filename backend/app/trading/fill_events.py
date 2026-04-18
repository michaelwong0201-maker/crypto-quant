"""User Stream 成交通知 → 网格补单（按策略实例分队列）。"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class GridFillEvent:
    strategy_instance_id: int
    side: str  # BUY | SELL
    symbol: str
    fill_price: Decimal
    fill_qty: Decimal
    client_order_id: str
    exchange_order_id: str


_instance_queues: dict[int, asyncio.Queue[GridFillEvent]] = {}


def get_fill_queue(instance_id: int) -> asyncio.Queue[GridFillEvent]:
    q = _instance_queues.get(instance_id)
    if q is None:
        q = asyncio.Queue(maxsize=5000)
        _instance_queues[instance_id] = q
    return q
