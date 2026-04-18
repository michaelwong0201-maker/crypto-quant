"""网格策略关联的交易所挂单撤销。"""
from __future__ import annotations

from app.trading.binance import BinanceTestnetConnector


async def cancel_grid_orders_for_instance(instance_id: int, symbol: str) -> int:
    conn = BinanceTestnetConnector()
    sym = symbol.upper().replace("/", "")
    cancelled = 0
    try:
        orders = await conn.spot_open_orders(sym)
    except Exception:
        return 0
    prefix = f"g{instance_id}"
    for o in orders:
        cid = str(o.get("clientOrderId") or "")
        if cid.startswith(prefix):
            try:
                await conn.cancel_spot_order(sym, order_id=int(o["orderId"]))
                cancelled += 1
            except Exception:
                continue
    return cancelled
