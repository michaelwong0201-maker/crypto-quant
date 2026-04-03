from __future__ import annotations
from fastapi import APIRouter

from app.api import assets, auth, dashboard, market, risk, strategies, system, trading, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(strategies.router)
api_router.include_router(trading.router)
api_router.include_router(assets.router)
api_router.include_router(market.router)
api_router.include_router(risk.router)
api_router.include_router(system.router)
api_router.include_router(dashboard.router)
