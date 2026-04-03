from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Optional


class MarketType(str, Enum):
    SPOT = "spot"
    FUTURES_USDT = "futures_usdt"


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderIntent:
    """What the strategy asks for; trading layer maps this to exchange-specific params."""

    def __init__(
        self,
        symbol: str,
        side: OrderSide,
        quantity: str,
        market_type: MarketType,
        *,
        reduce_only: bool = False,
        client_order_id: Optional[str] = None,
        extra: Optional[dict[str, Any]] = None,
    ):
        self.symbol = symbol
        self.side = side
        self.quantity = quantity
        self.market_type = market_type
        self.reduce_only = reduce_only
        self.client_order_id = client_order_id
        self.extra = extra or {}


class ExchangeConnector(ABC):
    """All REST/WS and signing live behind implementations of this interface."""

    @abstractmethod
    async def place_market_order(self, intent: OrderIntent) -> dict[str, Any]:
        pass
