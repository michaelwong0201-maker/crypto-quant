from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    must_change_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    role: str = "viewer"


class UserCreateResponse(BaseModel):
    user: UserOut
    initial_password: str
