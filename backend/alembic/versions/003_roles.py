from __future__ import annotations

"""roles and user role_id

Revision ID: 003
Revises: 002
Create Date: 2026-04-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, Sequence[str], None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALL_KEYS = [
    "dashboard", "assets", "trading", "charts",
    "strategies", "risk", "system", "roles", "accounts",
]


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    op.add_column("users", sa.Column("role_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_users_role_id", "users", "roles", ["role_id"], ["id"])

    # Seed super-admin role and link admin user
    import json
    roles_t = sa.table(
        "roles",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("is_system", sa.Boolean),
        sa.column("permissions", sa.JSON),
    )
    op.bulk_insert(roles_t, [
        {"id": 1, "name": "超级管理员", "is_system": True, "permissions": json.dumps(ALL_KEYS)},
    ])

    users_t = sa.table("users", sa.column("id", sa.Integer), sa.column("role", sa.String), sa.column("role_id", sa.Integer))
    op.execute(users_t.update().where(users_t.c.role == "admin").values(role_id=1))


def downgrade() -> None:
    op.drop_constraint("fk_users_role_id", "users", type_="foreignkey")
    op.drop_column("users", "role_id")
    op.drop_index(op.f("ix_roles_name"), table_name="roles")
    op.drop_table("roles")
