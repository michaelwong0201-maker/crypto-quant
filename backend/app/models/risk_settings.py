from __future__ import annotations
from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RiskSettings(Base):
    __tablename__ = "risk_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trading_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    max_order_notional_usd: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=Decimal("10000"))
