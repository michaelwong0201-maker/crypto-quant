from __future__ import annotations

import secrets
import string
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.user import UserCreateRequest, UserCreateResponse, UserOut

router = APIRouter(prefix="/users", tags=["users"])


def _rand_password(n: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


@router.get("", response_model=list[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> list[User]:
    r = await db.execute(select(User).order_by(User.id))
    return list(r.scalars().all())


@router.post("", response_model=UserCreateResponse)
async def create_user(
    body: UserCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> UserCreateResponse:
    r = await db.execute(select(User).where(User.username == body.username))
    if r.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Username taken")
    if body.role not in {UserRole.admin.value, UserRole.operator.value, UserRole.viewer.value}:
        raise HTTPException(status_code=400, detail="Invalid role")
    pwd = _rand_password()
    u = User(
        username=body.username,
        hashed_password=hash_password(pwd),
        role=body.role,
        must_change_password=True,
    )
    db.add(u)
    await db.flush()
    db.add(AuditLog(user_id=admin.id, action="user_create", detail={"target": u.username}))
    await db.commit()
    await db.refresh(u)
    return UserCreateResponse(user=UserOut.model_validate(u), initial_password=pwd)


@router.patch("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> User:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="Not found")
    if u.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate self")
    u.is_active = False
    db.add(AuditLog(user_id=admin.id, action="user_deactivate", detail={"target_id": user_id}))
    await db.commit()
    await db.refresh(u)
    return u


@router.patch("/{user_id}/activate", response_model=UserOut)
async def activate_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> User:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="Not found")
    u.is_active = True
    db.add(AuditLog(user_id=admin.id, action="user_activate", detail={"target_id": user_id}))
    await db.commit()
    await db.refresh(u)
    return u


class ResetPasswordResponse(BaseModel):
    new_password: str


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> ResetPasswordResponse:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="Not found")
    pwd = _rand_password()
    u.hashed_password = hash_password(pwd)
    u.must_change_password = True
    db.add(AuditLog(user_id=admin.id, action="user_reset_password", detail={"target_id": user_id}))
    await db.commit()
    return ResetPasswordResponse(new_password=pwd)


@router.get("/audit-logs")
async def user_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.admin))],
    limit: int = Query(default=50, le=200),
) -> list[dict]:
    rows = (
        await db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit))
    ).scalars().all()
    return [
        {
            "id": r.id, "user_id": r.user_id, "action": r.action,
            "detail": r.detail,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
