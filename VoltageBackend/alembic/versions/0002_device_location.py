"""device location: district, lat, lon

Revision ID: 0002_device_location
Revises: 0001_initial
Create Date: 2026-06-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_device_location"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("district", sa.String(length=64), nullable=True))
    op.add_column("devices", sa.Column("lat", sa.Float(), nullable=True))
    op.add_column("devices", sa.Column("lon", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "lon")
    op.drop_column("devices", "lat")
    op.drop_column("devices", "district")
