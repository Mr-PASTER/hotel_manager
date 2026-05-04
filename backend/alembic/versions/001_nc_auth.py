"""Add nc_login and nc_password_encrypted, drop bot_token_encrypted

Revision ID: 001_nc_auth
Revises:
Create Date: 2026-05-04

Run manually:
  docker exec -it <backend_container> alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa


revision = "001_nc_auth"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column(
        "app_settings",
        sa.Column("nc_login", sa.String(), nullable=True, server_default=""),
    )
    op.add_column(
        "app_settings",
        sa.Column("nc_password_encrypted", sa.String(), nullable=True, server_default=""),
    )
    # Remove old bot_token column (safe — data can be migrated manually if needed)
    op.drop_column("app_settings", "bot_token_encrypted")


def downgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column("bot_token_encrypted", sa.String(), nullable=True, server_default=""),
    )
    op.drop_column("app_settings", "nc_password_encrypted")
    op.drop_column("app_settings", "nc_login")
