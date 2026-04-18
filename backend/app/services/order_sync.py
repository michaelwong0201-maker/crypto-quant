"""将 Binance User Stream executionReport 同步到 order_records，并投递网格补单事件。"""
from __future__ import annotations

import logging
import re
from decimal import Decimal

from sqlalchemy import or_, select

from app.db.session import SessionLocal
from app.models.order_record import OrderRecord
from app.trading.fill_events import GridFillEvent, get_fill_queue

logger = logging.getLogger(__name__)

_GRID_CID = re.compile(r"^g(\d+)([bs])(\d+)(?:n(\d+))?$")


def _map_status(x: str) -> str:
    return {
        "NEW": "open",
        "PARTIALLY_FILLED": "partial",
        "FILLED": "filled",
        "CANCELED": "canceled",
        "REJECTED": "rejected",
        "EXPIRED": "canceled",
    }.get(x, x.lower())


async def apply_execution_report(data: dict) -> None:
    if data.get("e") != "executionReport":
        return
    cid = str(data.get("c") or "")
    oid = str(data.get("i") or "")
    x = str(data.get("X") or "")
    local = _map_status(x)

    async with SessionLocal() as session:
        conds = []
        if cid:
            conds.append(OrderRecord.client_order_id == cid)
        if oid:
            conds.append(OrderRecord.exchange_order_id == oid)
        if not conds:
            return
        stmt = select(OrderRecord).where(or_(*conds))
        rec = (await session.execute(stmt)).scalar_one_or_none()
        if rec:
            rec.status = local
            if oid and not rec.exchange_order_id:
                rec.exchange_order_id = oid
            rec.exchange_response = dict(data)
            await session.commit()
        elif cid or oid:
            logger.debug("executionReport no local order: cid=%s oid=%s X=%s", cid, oid, x)

    if x != "FILLED" or not cid.startswith("g"):
        return

    m = _GRID_CID.match(cid)
    if not m:
        return

    inst_id = int(m.group(1))
    sym = str(data.get("s") or "")
    side = str(data.get("S") or "")
    z = Decimal(str(data.get("z") or "0"))
    px = Decimal(str(data.get("p") or data.get("L") or "0"))
    if z <= 0 or px <= 0:
        return

    ev = GridFillEvent(
        strategy_instance_id=inst_id,
        side=side,
        symbol=sym,
        fill_price=px,
        fill_qty=z,
        client_order_id=cid,
        exchange_order_id=oid,
    )
    try:
        get_fill_queue(inst_id).put_nowait(ev)
    except Exception as e:
        logger.warning("fill_queue full or error instance=%s: %s", inst_id, e)
