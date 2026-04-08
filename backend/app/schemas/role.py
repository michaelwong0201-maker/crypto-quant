from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RoleOut(BaseModel):
    id: int
    name: str
    is_system: bool
    permissions: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    permissions: list[str] = Field(default_factory=list)


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    permissions: Optional[list[str]] = None
