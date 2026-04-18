from __future__ import annotations
import hashlib
import hmac
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.trading.exchange_base import ExchangeConnector, OrderIntent, OrderSide


def _norm_symbol(symbol: str) -> str:
    return symbol.replace("/", "").upper()


_shared_client: httpx.AsyncClient | None = None


def _get_shared_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _shared_client


class BinanceTestnetConnector(ExchangeConnector):
    """Binance 现货 REST：testnet / demo（模拟）/ live，由 `settings.spot_trading_env()` 决定。"""

    def __init__(self) -> None:
        self._key = settings.binance_api_key
        self._secret = settings.binance_api_secret

    def _get_spot_base(self) -> str:
        if settings.binance_spot_rest_base_override.strip():
            base = settings.binance_spot_rest_base_override.rstrip("/")
        else:
            env = settings.spot_trading_env()
            if env == "testnet":
                base = settings.binance_spot_testnet_base_url.rstrip("/")
            elif env == "demo":
                base = settings.binance_spot_demo_base_url.rstrip("/")
            else:
                base = settings.binance_spot_live_base_url.rstrip("/")
        # 路径已含 /api/v3/...；若基址写成 .../api 会拼成 .../api/api/v3/...
        if base.endswith("/api"):
            base = base[: -len("/api")].rstrip("/")
        return base

    def spot_ws_url(self) -> str:
        if settings.binance_spot_ws_url_override.strip():
            return settings.binance_spot_ws_url_override.strip()
        env = settings.spot_trading_env()
        if env == "testnet":
            return settings.binance_spot_ws_testnet
        if env == "demo":
            return settings.binance_spot_ws_demo
        return settings.binance_spot_ws_live

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
        client = _get_shared_client()
        url = f"{base}{path}"
        r = await client.request(method, url, params=p, headers=self._headers() if signed else None)
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, dict) else {"raw": data}

    async def place_market_order(self, intent: OrderIntent) -> dict[str, Any]:
        sym = _norm_symbol(intent.symbol)
        if intent.order_type == "LIMIT" and intent.limit_price:
            return await self.place_limit_spot(
                sym,
                intent.side.value,
                intent.quantity,
                intent.limit_price,
                client_order_id=intent.client_order_id,
            )
        params: dict[str, Any] = {
            "symbol": sym,
            "side": intent.side.value,
            "type": "MARKET",
            "quantity": intent.quantity,
        }
        if intent.client_order_id:
            params["newClientOrderId"] = intent.client_order_id
        return await self._request("POST", self._get_spot_base(), "/api/v3/order", params, signed=True)

    async def spot_balances(self) -> list[dict[str, Any]]:
        data = await self._request("GET", self._get_spot_base(), "/api/v3/account", {}, signed=True)
        return list(data.get("balances", []))

    async def public_klines(self, symbol: str, interval: str, limit: int = 200) -> list[list[Any]]:
        base = self._get_spot_base()
        params = {"symbol": _norm_symbol(symbol), "interval": interval, "limit": limit}
        client = _get_shared_client()
        r = await client.get(f"{base}/api/v3/klines", params=params)
        r.raise_for_status()
        return r.json()

    async def spot_ticker_price(self, symbol: str) -> dict[str, Any]:
        sym = _norm_symbol(symbol)
        client = _get_shared_client()
        r = await client.get(f"{self._get_spot_base()}/api/v3/ticker/price", params={"symbol": sym})
        r.raise_for_status()
        return r.json()

    async def place_limit_spot(
        self,
        symbol: str,
        side: str,
        quantity: str,
        price: str,
        *,
        client_order_id: str | None = None,
        time_in_force: str = "GTC",
    ) -> dict[str, Any]:
        sym = _norm_symbol(symbol)
        params: dict[str, Any] = {
            "symbol": sym,
            "side": side,
            "type": "LIMIT",
            "timeInForce": time_in_force,
            "quantity": quantity,
            "price": price,
        }
        if client_order_id:
            params["newClientOrderId"] = client_order_id
        return await self._request("POST", self._get_spot_base(), "/api/v3/order", params, signed=True)

    async def cancel_spot_order(
        self,
        symbol: str,
        *,
        order_id: int | None = None,
        orig_client_order_id: str | None = None,
    ) -> dict[str, Any]:
        sym = _norm_symbol(symbol)
        params: dict[str, Any] = {"symbol": sym}
        if order_id is not None:
            params["orderId"] = order_id
        if orig_client_order_id:
            params["origClientOrderId"] = orig_client_order_id
        return await self._request("DELETE", self._get_spot_base(), "/api/v3/order", params, signed=True)

    async def spot_open_orders(self, symbol: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {}
        if symbol:
            params["symbol"] = _norm_symbol(symbol)
        data = await self._request("GET", self._get_spot_base(), "/api/v3/openOrders", params, signed=True)
        return data if isinstance(data, list) else []

    def spot_user_stream_ws_url(self, listen_key: str) -> str:
        env = settings.spot_trading_env()
        if env == "testnet":
            base = settings.binance_spot_user_stream_ws_testnet.rstrip("/")
        elif env == "demo":
            base = settings.binance_spot_user_stream_ws_demo.rstrip("/")
        else:
            base = settings.binance_spot_user_stream_ws_live.rstrip("/")
        return f"{base}/{listen_key}"

    async def spot_create_listen_key(self) -> str:
        if not self._key:
            raise ValueError("BINANCE_API_KEY required for user stream")
        client = _get_shared_client()
        r = await client.post(
            f"{self._get_spot_base()}/api/v3/userDataStream",
            headers=self._headers(),
        )
        r.raise_for_status()
        return str(r.json()["listenKey"])

    async def spot_keepalive_listen_key(self, listen_key: str) -> None:
        client = _get_shared_client()
        r = await client.put(
            f"{self._get_spot_base()}/api/v3/userDataStream",
            params={"listenKey": listen_key},
            headers=self._headers(),
        )
        r.raise_for_status()
