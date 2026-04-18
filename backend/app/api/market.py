from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.data_service import fetch_and_store_klines, get_stored_klines
from app.trading.binance import BinanceTestnetConnector

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/klines")
async def klines(
    _: Annotated[User, Depends(get_current_user)],
    symbol: str = Query(default="BTCUSDT"),
    interval: str = Query(default="1m"),
    limit: int = Query(default=200, le=1000),
    market: str = Query(default="spot"),
) -> dict[str, Any]:
    if market != "spot":
        raise HTTPException(status_code=400, detail="only spot market is supported")
    conn = BinanceTestnetConnector()
    try:
        raw = await conn.public_klines(symbol, interval, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    rows = [
        {
            "time": int(k[0]) // 1000,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        }
        for k in raw
    ]
    return {"symbol": symbol.upper(), "interval": interval, "market": market, "data": rows}


@router.get("/ticker")
async def ticker(
    _: Annotated[User, Depends(get_current_user)],
    symbol: str = Query(default="BTCUSDT"),
) -> dict[str, Any]:
    conn = BinanceTestnetConnector()
    try:
        data = await conn.spot_ticker_price(symbol)
        return {"symbol": data.get("symbol", symbol), "price": data.get("price", "0")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/tickers")
async def tickers(
    _: Annotated[User, Depends(get_current_user)],
) -> list[dict[str, Any]]:
    symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]
    conn = BinanceTestnetConnector()
    result = []
    for sym in symbols:
        try:
            data = await conn.spot_ticker_price(sym)
            result.append({"symbol": data.get("symbol", sym), "price": data.get("price", "0")})
        except Exception:
            result.append({"symbol": sym, "price": "N/A"})
    return result


@router.post("/klines/sync")
async def sync_klines(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    symbol: str = Query(default="BTCUSDT"),
    interval: str = Query(default="1h"),
    market: str = Query(default="spot"),
    limit: int = Query(default=500, le=1000),
) -> dict[str, Any]:
    try:
        count = await fetch_and_store_klines(db, symbol, interval, market, limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"synced": count, "symbol": symbol, "interval": interval}


@router.get("/klines/stored")
async def stored_klines(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    symbol: str = Query(default="BTCUSDT"),
    interval: str = Query(default="1h"),
    market: str = Query(default="spot"),
    limit: int = Query(default=500, le=1000),
) -> dict[str, Any]:
    rows = await get_stored_klines(db, symbol, interval, market, limit)
    return {"symbol": symbol, "interval": interval, "data": rows}
