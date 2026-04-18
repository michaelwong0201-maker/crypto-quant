from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.kline import Kline
from app.trading.binance import BinanceTestnetConnector

async def fetch_and_store_klines(
    db: AsyncSession,
    symbol: str = "BTCUSDT",
    interval: str = "1h",
    market_type: str = "spot",
    limit: int = 500,
) -> int:
    """Fetch klines from Binance and upsert into DB. Returns count of new records."""
    conn = BinanceTestnetConnector()
    raw = await conn.public_klines(symbol, interval, limit=limit)
    
    count = 0
    for row in raw:
        open_time = int(row[0])
        existing = await db.execute(
            select(Kline).where(
                Kline.symbol == symbol,
                Kline.interval == interval,
                Kline.market_type == market_type,
                Kline.open_time == open_time,
            )
        )
        if existing.scalar_one_or_none():
            continue
        kline = Kline(
            symbol=symbol, interval=interval, market_type=market_type,
            open_time=open_time,
            open=str(row[1]), high=str(row[2]), low=str(row[3]), close=str(row[4]),
            volume=str(row[5]), close_time=int(row[6]),
        )
        db.add(kline)
        count += 1
    await db.commit()
    return count

async def get_stored_klines(
    db: AsyncSession,
    symbol: str = "BTCUSDT",
    interval: str = "1h",
    market_type: str = "spot",
    limit: int = 500,
) -> list[dict]:
    """Get klines from DB ordered by time."""
    result = await db.execute(
        select(Kline)
        .where(Kline.symbol == symbol, Kline.interval == interval, Kline.market_type == market_type)
        .order_by(Kline.open_time.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "time": r.open_time // 1000,
            "open": float(r.open), "high": float(r.high),
            "low": float(r.low), "close": float(r.close),
            "volume": float(r.volume),
        }
        for r in reversed(rows)
    ]
