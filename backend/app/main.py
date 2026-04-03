from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import APP_VERSION, settings
from app.db.session import SessionLocal
from app.services.seed import run_seed

_FRONTEND_DIR = Path(__file__).resolve().parent / "static" / "frontend"


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with SessionLocal() as session:
        await run_seed(session)
    yield


app = FastAPI(
    title="Crypto Quant API",
    version=APP_VERSION,
    description="Data + Strategy + Trading (Binance testnet spot & futures)",
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
    return {"status": "ok", "env": settings.app_env, "version": APP_VERSION}


@app.get("/")
async def root_redirect():
    if (_FRONTEND_DIR / "index.html").is_file():
        return RedirectResponse(url="/app/")
    return {"service": "crypto-quant", "version": APP_VERSION, "docs": "/docs"}


if (_FRONTEND_DIR / "index.html").is_file():
    app.mount("/app", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
