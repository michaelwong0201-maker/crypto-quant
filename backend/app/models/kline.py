from __future__ import annotations

from sqlalchemy import BigInteger, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Kline(Base):
    __tablename__ = "klines"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    interval: Mapped[str] = mapped_column(String(8), nullable=False)
    market_type: Mapped[str] = mapped_column(String(16), nullable=False, default="spot")
    open_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    open: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False)
    high: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False)
    low: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False)
    close: Mapped[str] = mapped_column(Numeric(24, 8), nullable=False)
    volume: Mapped[str] = mapped_column(Numeric(32, 8), nullable=False)
    close_time: Mapped[int] = mapped_column(BigInteger, nullable=False)

    __table_args__ = (
        Index("ix_klines_lookup", "symbol", "interval", "market_type", "open_time", unique=True),
    )
