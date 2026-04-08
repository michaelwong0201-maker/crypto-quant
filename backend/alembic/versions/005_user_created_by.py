from __future__ import annotations

"""add created_by to users

Revision ID: 005
Revises: 004
Create Date: 2026-04-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, Sequence[str], None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("created_by", sa.String(64), nullable=True))
    users_t = sa.table("users", sa.column("username", sa.String), sa.column("created_by", sa.String))
    op.execute(users_t.update().where(users_t.c.username == "admin").values(created_by="system"))


def downgrade() -> None:
    op.drop_column("users", "created_by")
