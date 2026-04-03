from __future__ import annotations

from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.alert import AlertEvent, AlertRule
from app.models.audit_log import AuditLog
from app.models.risk_settings import RiskSettings
from app.models.user import User, UserRole
from app.schemas.trading import RiskSettingsOut, RiskSettingsUpdate

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/settings", response_model=RiskSettingsOut)
async def get_risk(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> RiskSettings:
    r = await db.execute(select(RiskSettings).order_by(RiskSettings.id).limit(1))
    row = r.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=500, detail="Risk settings not initialized")
    return row


@router.put("/settings", response_model=RiskSettingsOut)
async def put_risk(
    body: RiskSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.operator))],
) -> RiskSettings:
    r = await db.execute(select(RiskSettings).order_by(RiskSettings.id).limit(1))
    row = r.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=500, detail="Risk settings not initialized")
    if body.trading_enabled is not None:
        row.trading_enabled = body.trading_enabled
    if body.max_order_notional_usd is not None:
        row.max_order_notional_usd = Decimal(str(body.max_order_notional_usd))
    db.add(AuditLog(user_id=user.id, action="risk_update", detail=body.model_dump(exclude_none=True)))
    await db.commit()
    await db.refresh(row)
    return row


# --- Alert Rules ---

class AlertRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    rule_type: str = Field(min_length=1, max_length=32)
    config: dict[str, Any] = Field(default_factory=dict)


@router.get("/alerts/rules")
async def list_alert_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    q = select(AlertRule).where(AlertRule.user_id == user.id).order_by(AlertRule.id.desc())
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": r.id, "name": r.name, "rule_type": r.rule_type,
            "config": r.config, "enabled": r.enabled,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.post("/alerts/rules")
async def create_alert_rule(
    body: AlertRuleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    rule = AlertRule(
        user_id=user.id, name=body.name,
        rule_type=body.rule_type, config=body.config,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": rule.id, "name": rule.name, "status": "created"}


@router.delete("/alerts/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    r = await db.execute(select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == user.id))
    rule = r.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(rule)
    await db.commit()
    return {"status": "deleted"}


@router.get("/alerts/events")
async def list_alert_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = 50,
    unread_only: bool = False,
) -> list[dict]:
    q = select(AlertEvent).order_by(AlertEvent.id.desc()).limit(limit)
    if unread_only:
        q = q.where(AlertEvent.acknowledged.is_(False))
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": e.id, "level": e.level, "title": e.title,
            "message": e.message, "acknowledged": e.acknowledged,
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e in rows
    ]


@router.post("/alerts/events/{event_id}/ack")
async def ack_alert(
    event_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> dict:
    r = await db.execute(select(AlertEvent).where(AlertEvent.id == event_id))
    ev = r.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    ev.acknowledged = True
    await db.commit()
    return {"status": "acknowledged"}
