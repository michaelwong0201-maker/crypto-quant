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
from app.models.role import Role
from app.models.user import User, UserRole
from app.schemas.user import UserCreateRequest, UserCreateResponse, UserOut

router = APIRouter(prefix="/users", tags=["users"])


def _rand_password(n: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


async def _user_with_role_name(db: AsyncSession, user: User) -> UserOut:
    """Build UserOut with role_name resolved from Role table."""
    role_name = None
    if user.role_id:
        r = await db.execute(select(Role.name).where(Role.id == user.role_id))
        role_name = r.scalar_one_or_none()
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        role_id=user.role_id,
        role_name=role_name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        created_by=user.created_by,
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> list[UserOut]:
    r = await db.execute(select(User).order_by(User.id))
    users = list(r.scalars().all())
    # Batch load role names
    role_ids = {u.role_id for u in users if u.role_id}
    role_map: dict[int, str] = {}
    if role_ids:
        rr = await db.execute(select(Role.id, Role.name).where(Role.id.in_(role_ids)))
        role_map = {row.id: row.name for row in rr}
    return [
        UserOut(
            id=u.id, username=u.username, role=u.role,
            role_id=u.role_id, role_name=role_map.get(u.role_id) if u.role_id else None,
            is_active=u.is_active, must_change_password=u.must_change_password,
            created_by=u.created_by, created_at=u.created_at,
        )
        for u in users
    ]


@router.post("", response_model=UserCreateResponse)
async def create_user(
    body: UserCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> UserCreateResponse:
    r = await db.execute(select(User).where(User.username == body.username))
    if r.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="该账号已存在，不可重复创建")
    # Validate role
    rr = await db.execute(select(Role).where(Role.id == body.role_id))
    role = rr.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=400, detail="角色不存在")
    if role.is_system:
        raise HTTPException(status_code=400, detail="不能选择系统内置角色")
    pwd = _rand_password()
    u = User(
        username=body.username,
        hashed_password=hash_password(pwd),
        role="custom",
        role_id=body.role_id,
        is_active=False,
        must_change_password=False,
        created_by=admin.username,
    )
    db.add(u)
    await db.flush()
    db.add(AuditLog(user_id=admin.id, action="user_create", detail={"target": u.username}))
    await db.commit()
    await db.refresh(u)
    out = await _user_with_role_name(db, u)
    return UserCreateResponse(user=out, initial_password=pwd)


@router.patch("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> UserOut:
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
    return await _user_with_role_name(db, u)


@router.patch("/{user_id}/activate", response_model=UserOut)
async def activate_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> UserOut:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="Not found")
    u.is_active = True
    db.add(AuditLog(user_id=admin.id, action="user_activate", detail={"target_id": user_id}))
    await db.commit()
    await db.refresh(u)
    return await _user_with_role_name(db, u)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> None:
    r = await db.execute(select(User).where(User.id == user_id))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="Not found")
    if u.role == UserRole.admin.value:
        raise HTTPException(status_code=400, detail="超级管理员账号不可删除")
    if u.id == admin.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    await db.delete(u)
    db.add(AuditLog(user_id=admin.id, action="user_delete", detail={"target": u.username}))
    await db.commit()


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
    u.must_change_password = False
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
