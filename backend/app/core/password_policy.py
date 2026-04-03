from __future__ import annotations
from fastapi import Depends, HTTPException, status

from app.core.deps import get_current_user
from app.models.user import User


async def require_password_changed(user: User = Depends(get_current_user)) -> User:
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must change your password before using this feature",
        )
    return user
