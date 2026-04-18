"""等差网格价位计算（现货单向做多网格）。"""
from __future__ import annotations

from decimal import Decimal
from typing import List


def arithmetic_grid_prices(lower: Decimal, upper: Decimal, grid_count: int) -> List[Decimal]:
    """在 [lower, upper] 上生成 grid_count+1 个等差网格线（含端点）。"""
    if grid_count < 2:
        raise ValueError("grid_count must be >= 2")
    if lower >= upper:
        raise ValueError("lower must be < upper")
    step = (upper - lower) / grid_count
    return [lower + step * Decimal(i) for i in range(grid_count + 1)]


def format_price(p: Decimal, decimals: int = 2) -> str:
    q = Decimal("1." + "0" * decimals)
    return str(p.quantize(q))


def format_qty(qty: Decimal, decimals: int = 5) -> str:
    q = Decimal("1." + "0" * decimals)
    return str(qty.quantize(q))
