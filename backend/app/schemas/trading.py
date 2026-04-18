from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class PlaceOrderRequest(BaseModel):
    symbol: str = Field(examples=["BTCUSDT"])
    side: Literal["BUY", "SELL"]
    quantity: str


class OrderRecordOut(BaseModel):
    id: int
    symbol: str
    side: str
    quantity: str
    market_type: str
    status: str
    exchange_order_id: Optional[str]
    client_order_id: Optional[str] = None
    order_type: str = "MARKET"
    price: Optional[str] = None
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RiskSettingsOut(BaseModel):
    id: int
    trading_enabled: bool
    max_order_notional_usd: float


class RiskSettingsUpdate(BaseModel):
    trading_enabled: Optional[bool] = None
    max_order_notional_usd: Optional[float] = None
