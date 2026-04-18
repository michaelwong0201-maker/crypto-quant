from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order_record import OrderRecord
from app.models.user import User
from app.trading.binance import BinanceTestnetConnector
from app.trading.exchange_base import OrderIntent
from app.trading.risk_gateway import ensure_risk_allows


async def execute_order_intent(
    db: AsyncSession,
    user: Optional[User],
    intent: OrderIntent,
    *,
    strategy_instance_id: Optional[int] = None,
) -> OrderRecord:
    connector = BinanceTestnetConnector()
    await ensure_risk_allows(db, intent, connector)

    rec = OrderRecord(
        user_id=user.id if user else None,
        strategy_instance_id=strategy_instance_id,
        symbol=intent.symbol,
        side=intent.side.value,
        quantity=intent.quantity,
        market_type=intent.market_type.value,
        status="pending",
        order_type=intent.order_type,
        price=intent.limit_price,
        client_order_id=intent.client_order_id,
    )
    db.add(rec)
    await db.flush()
    try:
        resp = await connector.place_market_order(intent)
        oid = resp.get("orderId")
        rec.exchange_order_id = str(oid) if oid is not None else None
        rec.exchange_response = resp
        rec.status = "submitted"
    except Exception as e:
        rec.status = "failed"
        rec.error_message = str(e)
    await db.commit()
    await db.refresh(rec)
    return rec
