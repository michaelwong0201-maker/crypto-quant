from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.role import ALL_PERMISSION_KEYS, Role
from app.models.user import User, UserRole
from app.schemas.role import RoleCreateRequest, RoleOut, RoleUpdateRequest

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("")
async def list_roles(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> list[dict]:
    r = await db.execute(select(Role).order_by(Role.id))
    roles = list(r.scalars().all())
    # Count active users per role
    cnt_r = await db.execute(
        select(User.role_id, sa_func.count())
        .where(User.is_active.is_(True), User.role_id.isnot(None))
        .group_by(User.role_id)
    )
    cnt_map = {row[0]: row[1] for row in cnt_r}
    return [
        {
            "id": rl.id, "name": rl.name, "is_system": rl.is_system,
            "permissions": rl.permissions, "created_by": rl.created_by,
            "created_at": rl.created_at.isoformat() if rl.created_at else None,
            "active_user_count": cnt_map.get(rl.id, 0),
        }
        for rl in roles
    ]


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: RoleCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> Role:
    dup = await db.execute(select(Role).where(Role.name == body.name))
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="角色名称已存在")
    invalid = set(body.permissions) - set(ALL_PERMISSION_KEYS)
    if invalid:
        raise HTTPException(status_code=400, detail=f"无效的权限 key: {invalid}")
    role = Role(name=body.name, permissions=body.permissions, created_by=admin.username)
    db.add(role)
    await db.flush()
    db.add(AuditLog(user_id=admin.id, action="role_create", detail={"role": body.name}))
    await db.commit()
    await db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    body: RoleUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> Role:
    r = await db.execute(select(Role).where(Role.id == role_id))
    role = r.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统内置角色不可编辑")
    if body.name is not None and body.name != role.name:
        dup = await db.execute(select(Role).where(Role.name == body.name))
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="角色名称已存在")
        role.name = body.name
    if body.permissions is not None:
        invalid = set(body.permissions) - set(ALL_PERMISSION_KEYS)
        if invalid:
            raise HTTPException(status_code=400, detail=f"无效的权限 key: {invalid}")
        role.permissions = body.permissions
    db.add(AuditLog(user_id=admin.id, action="role_update", detail={"role_id": role_id}))
    await db.commit()
    await db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> None:
    r = await db.execute(select(Role).where(Role.id == role_id))
    role = r.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统内置角色不可删除")
    cnt_r = await db.execute(select(sa_func.count()).select_from(User).where(User.role_id == role_id))
    cnt = cnt_r.scalar() or 0
    if cnt > 0:
        raise HTTPException(status_code=400, detail=f"该角色下仍有 {cnt} 个用户，无法删除")
    await db.delete(role)
    db.add(AuditLog(user_id=admin.id, action="role_delete", detail={"role": role.name}))
    await db.commit()
