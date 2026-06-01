"""device address (manual manzil)

Revision ID: 0003_device_address
Revises: 0002_device_location
Create Date: 2026-06-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_device_address"
down_revision: Union[str, None] = "0002_device_location"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("address", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "address")
