"""device SIM info: iccid, phone

Revision ID: 0005_device_sim
Revises: 0004_device_image
Create Date: 2026-06-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_device_sim"
down_revision: Union[str, None] = "0004_device_image"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("iccid", sa.String(length=32), nullable=True))
    op.add_column("devices", sa.Column("phone", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "phone")
    op.drop_column("devices", "iccid")
