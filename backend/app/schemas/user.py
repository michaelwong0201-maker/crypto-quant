from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    is_active: bool
    must_change_password: bool
    created_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    role_id: int


class UserCreateResponse(BaseModel):
    user: UserOut
    initial_password: str
