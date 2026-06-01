"""device image_url

Revision ID: 0004_device_image
Revises: 0003_device_address
Create Date: 2026-06-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_device_image"
down_revision: Union[str, None] = "0003_device_address"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices", sa.Column("image_url", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("devices", "image_url")
