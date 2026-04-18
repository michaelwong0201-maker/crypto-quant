from __future__ import annotations
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import APP_VERSION, settings
from app.db.session import SessionLocal
from app.services.binance_user_stream import run_spot_user_stream
from app.services.market_stream import run_spot_mini_ticker_stream
from app.services.seed import run_seed

_FRONTEND_DIR = Path(__file__).resolve().parent / "static" / "frontend"
logger = logging.getLogger(__name__)
_market_stop: asyncio.Event | None = None
_market_task: asyncio.Task[None] | None = None
_user_stream_task: asyncio.Task[None] | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _market_stop, _market_task, _user_stream_task
    async with SessionLocal() as session:
        await run_seed(session)
    _market_stop = asyncio.Event()
    if settings.binance_market_stream_enabled:
        _market_task = asyncio.create_task(run_spot_mini_ticker_stream(_market_stop))
        logger.info("Binance spot market stream task started")
    if settings.binance_user_stream_enabled:
        _user_stream_task = asyncio.create_task(run_spot_user_stream(_market_stop))
        logger.info("Binance spot user stream task started")
    yield
    if _market_stop is not None:
        _market_stop.set()
    if _market_task is not None:
        _market_task.cancel()
        try:
            await _market_task
        except asyncio.CancelledError:
            pass
        _market_task = None
    if _user_stream_task is not None:
        _user_stream_task.cancel()
        try:
            await _user_stream_task
        except asyncio.CancelledError:
            pass
        _user_stream_task = None


app = FastAPI(
    title="Crypto Quant API",
    version=APP_VERSION,
    description="Data + Strategy + Trading (Binance spot testnet / live)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.app_env == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health():
    from app.services.market_cache import market_stream_healthy, user_stream_healthy

    return {
        "status": "ok",
        "env": settings.app_env,
        "version": APP_VERSION,
        "spot_trading_env": settings.spot_trading_env(),
        "binance_testnet": settings.spot_trading_env() == "testnet",
        "market_stream_healthy": await market_stream_healthy(),
        "user_stream_healthy": await user_stream_healthy(),
    }


@app.get("/")
async def root_redirect():
    if (_FRONTEND_DIR / "index.html").is_file():
        return RedirectResponse(url="/app/")
    return {"service": "crypto-quant", "version": APP_VERSION, "docs": "/docs"}


if (_FRONTEND_DIR / "index.html").is_file():
    app.mount("/app", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
