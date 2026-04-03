from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    strategy_key: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    interval: Mapped[str] = mapped_column(String(8), nullable=False)
    config: Mapped[Any] = mapped_column(JSONB, default=dict)
    start_time: Mapped[str] = mapped_column(String(32), nullable=False)
    end_time: Mapped[str] = mapped_column(String(32), nullable=False)
    initial_capital: Mapped[Optional[str]] = mapped_column(Numeric(24, 8), nullable=True, default="10000")
    final_capital: Mapped[Optional[str]] = mapped_column(Numeric(24, 8), nullable=True)
    total_return_pct: Mapped[Optional[str]] = mapped_column(Numeric(12, 4), nullable=True)
    max_drawdown_pct: Mapped[Optional[str]] = mapped_column(Numeric(12, 4), nullable=True)
    win_rate: Mapped[Optional[str]] = mapped_column(Numeric(8, 4), nullable=True)
    total_trades: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sharpe_ratio: Mapped[Optional[str]] = mapped_column(Numeric(12, 4), nullable=True)
    trades_json: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    equity_curve_json: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
