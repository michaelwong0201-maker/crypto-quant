from __future__ import annotations

"""add created_by to roles

Revision ID: 004
Revises: 003
Create Date: 2026-04-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, Sequence[str], None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("roles", sa.Column("created_by", sa.String(64), nullable=True))
    roles_t = sa.table("roles", sa.column("id", sa.Integer), sa.column("created_by", sa.String))
    op.execute(roles_t.update().where(roles_t.c.id == 1).values(created_by="system"))


def downgrade() -> None:
    op.drop_column("roles", "created_by")
