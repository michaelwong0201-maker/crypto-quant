from __future__ import annotations
import hashlib
import hmac
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.trading.exchange_base import ExchangeConnector, MarketType, OrderIntent, OrderSide


def _norm_symbol(symbol: str) -> str:
    return symbol.replace("/", "").upper()


class BinanceTestnetConnector(ExchangeConnector):
    """Signed REST for Binance spot & USDT-M futures testnets."""

    def __init__(self) -> None:
        self._key = settings.binance_api_key
        self._secret = settings.binance_api_secret
        self._spot_base = settings.binance_spot_testnet_base_url.rstrip("/")
        self._fut_base = settings.binance_futures_testnet_base_url.rstrip("/")

    def _sign(self, query: str) -> str:
        return hmac.new(self._secret.encode(), query.encode(), hashlib.sha256).hexdigest()

    def _headers(self) -> dict[str, str]:
        return {"X-MBX-APIKEY": self._key}

    async def _request(
        self,
        method: str,
        base: str,
        path: str,
        params: dict[str, Any],
        *,
        signed: bool,
    ) -> dict[str, Any]:
        p = {k: v for k, v in params.items() if v is not None}
        if signed:
            p["timestamp"] = int(time.time() * 1000)
            if self._key == "" or self._secret == "":
                raise ValueError("BINANCE_API_KEY and BINANCE_API_SECRET must be set for signed calls")
            query = urlencode(sorted((str(k), str(v)) for k, v in p.items()))
            p["signature"] = self._sign(query)
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{base}{path}"
            r = await client.request(method, url, params=p, headers=self._headers() if signed else None)
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, dict) else {"raw": data}

    async def place_market_order(self, intent: OrderIntent) -> dict[str, Any]:
        sym = _norm_symbol(intent.symbol)
        if intent.market_type == MarketType.SPOT:
            params: dict[str, Any] = {
                "symbol": sym,
                "side": intent.side.value,
                "type": "MARKET",
                "quantity": intent.quantity,
            }
            if intent.client_order_id:
                params["newClientOrderId"] = intent.client_order_id
            return await self._request("POST", self._spot_base, "/api/v3/order", params, signed=True)
        params = {
            "symbol": sym,
            "side": intent.side.value,
            "type": "MARKET",
            "quantity": intent.quantity,
            "reduceOnly": "true" if intent.reduce_only else "false",
        }
        if intent.client_order_id:
            params["newClientOrderId"] = intent.client_order_id
        return await self._request("POST", self._fut_base, "/fapi/v1/order", params, signed=True)

    async def spot_balances(self) -> list[dict[str, Any]]:
        data = await self._request("GET", self._spot_base, "/api/v3/account", {}, signed=True)
        return list(data.get("balances", []))

    async def futures_balances(self) -> list[dict[str, Any]]:
        data = await self._request("GET", self._fut_base, "/fapi/v2/balance", {}, signed=True)
        return data if isinstance(data, list) else []

    async def public_klines(
        self, symbol: str, interval: str, limit: int = 200, *, futures: bool = False
    ) -> list[list[Any]]:
        base = self._fut_base if futures else self._spot_base
        path = "/fapi/v1/klines" if futures else "/api/v3/klines"
        params = {"symbol": _norm_symbol(symbol), "interval": interval, "limit": limit}
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{base}{path}", params=params)
            r.raise_for_status()
            return r.json()

    async def futures_mark_price(self, symbol: str) -> dict[str, Any]:
        sym = _norm_symbol(symbol)
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{self._fut_base}/fapi/v1/premiumIndex", params={"symbol": sym}
            )
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, dict) else {}

    async def spot_ticker_price(self, symbol: str) -> dict[str, Any]:
        sym = _norm_symbol(symbol)
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{self._spot_base}/api/v3/ticker/price", params={"symbol": sym})
            r.raise_for_status()
            return r.json()
