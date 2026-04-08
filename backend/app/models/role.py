from __future__ import annotations

from datetime import datetime

from typing import Optional

from sqlalchemy import Boolean, DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

ALL_PERMISSION_KEYS = [
    "dashboard", "assets", "trading", "charts",
    "strategies", "risk", "system", "roles", "accounts",
]


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    permissions: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
