from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class StrategyInstanceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    strategy_key: str = Field(default="simple_ma")
    config: dict[str, Any] = Field(default_factory=dict)


class StrategyInstanceOut(BaseModel):
    id: int
    name: str
    strategy_key: str
    config: dict[str, Any]
    owner_id: int
    created_at: datetime
    running: bool = False

    model_config = {"from_attributes": True}
