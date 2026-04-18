from __future__ import annotations
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


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
    run_status: str = "CREATED"

    model_config = {"from_attributes": True}

    @field_validator("config", mode="before")
    @classmethod
    def _config_must_be_dict(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, dict):
            return v
        return {}

    @field_validator("run_status", mode="before")
    @classmethod
    def _run_status_default(cls, v: Any) -> str:
        if isinstance(v, str) and v.strip():
            return v
        return "CREATED"
