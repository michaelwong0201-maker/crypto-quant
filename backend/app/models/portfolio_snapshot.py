from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    total_equity_usd: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False)
    spot_value_usd: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False, default="0")
    futures_value_usd: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False, default="0")
    unrealized_pnl_usd: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False, default="0")
    snapshot_data: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
