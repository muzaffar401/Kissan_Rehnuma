"""create weather tables

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-08-30

Base revision of the weather-alert-service chain. The shared `farmers`
table is created by user-auth-service and is assumed to exist before
this migration runs. This chain tracks its own version table
(`weather_alembic_version`, see alembic/env.py) so it can coexist with
the auth-service chain on the same database.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Coordinates per farmer (the shared farmers table has no longitude).
    # FK points at farmers, which is created/owned by user-auth-service
    # migration 6e0e749a21df (already applied before this revision).
    op.create_table(
        'farmer_locations',
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id']),
        sa.PrimaryKeyConstraint('farmer_id')
    )

    # weather_snapshots / alerts_sent reference farmers by id only —
    # no DB-level FK so this chain stays independent of the farmers schema.
    op.create_table(
        'weather_snapshots',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=False),
        sa.Column('humidity', sa.Float(), nullable=True),
        sa.Column('wind_speed_kmh', sa.Float(), nullable=True),
        sa.Column('rain_mm', sa.Float(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=True),
        sa.Column('fetched_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_weather_snapshots_farmer_id'),
        'weather_snapshots', ['farmer_id'], unique=False
    )

    op.create_table(
        'alerts_sent',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sa.String(length=30), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('risk_detected', sa.Boolean(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_alerts_sent_farmer_id'),
        'alerts_sent', ['farmer_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_alerts_sent_farmer_id'), table_name='alerts_sent')
    op.drop_table('alerts_sent')
    op.drop_index(
        op.f('ix_weather_snapshots_farmer_id'), table_name='weather_snapshots'
    )
    op.drop_table('weather_snapshots')
    op.drop_table('farmer_locations')
