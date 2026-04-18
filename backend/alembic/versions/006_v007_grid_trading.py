"""v0.0.7 grid strategy + order fields

Revision ID: 006
Revises: 005
Create Date: 2026-04-18

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, Sequence[str], None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "strategy_instances",
        sa.Column("run_status", sa.String(length=32), server_default="CREATED", nullable=False),
    )
    op.add_column("strategy_instances", sa.Column("last_error", sa.Text(), nullable=True))
    op.add_column(
        "strategy_instances",
        sa.Column(
            "grid_runtime",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.add_column("order_records", sa.Column("client_order_id", sa.String(length=64), nullable=True))
    op.add_column(
        "order_records",
        sa.Column("order_type", sa.String(length=16), server_default="MARKET", nullable=False),
    )
    op.add_column("order_records", sa.Column("price", sa.String(length=64), nullable=True))
    op.create_index("ix_order_records_client_order_id", "order_records", ["client_order_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_order_records_client_order_id", table_name="order_records")
    op.drop_column("order_records", "price")
    op.drop_column("order_records", "order_type")
    op.drop_column("order_records", "client_order_id")
    op.drop_column("strategy_instances", "grid_runtime")
    op.drop_column("strategy_instances", "last_error")
    op.drop_column("strategy_instances", "run_status")
