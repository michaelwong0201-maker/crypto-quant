from __future__ import annotations
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.placeholders import AltDataJob, ChainFeedJob
from app.models.risk_settings import RiskSettings
from app.models.user import User, UserRole


async def run_seed(session: AsyncSession) -> None:
    r = await session.execute(select(User).where(User.username == "admin"))
    if r.scalar_one_or_none() is None:
        session.add(
            User(
                username="admin",
                hashed_password=hash_password("123456"),
                role=UserRole.admin.value,
                is_active=True,
                must_change_password=False,
            )
        )

    r2 = await session.execute(select(RiskSettings).limit(1))
    if r2.scalar_one_or_none() is None:
        session.add(RiskSettings(trading_enabled=True, max_order_notional_usd=Decimal("10000")))

    r3 = await session.execute(select(ChainFeedJob).limit(1))
    if r3.scalar_one_or_none() is None:
        session.add(ChainFeedJob(name="placeholder_chain_sync", config={}))

    r4 = await session.execute(select(AltDataJob).limit(1))
    if r4.scalar_one_or_none() is None:
        session.add(AltDataJob(name="placeholder_alt_data", description="V0.0.1 placeholder"))

    await session.commit()
