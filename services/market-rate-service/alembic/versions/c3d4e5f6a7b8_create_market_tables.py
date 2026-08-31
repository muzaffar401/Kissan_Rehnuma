"""create market tables

Revision ID: c3d4e5f6a7b8
Revises:
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'mandis',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'crops',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    op.create_table(
        'prices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('mandi_id', sa.Integer(), nullable=False),
        sa.Column('crop_id', sa.Integer(), nullable=False),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('recorded_date', sa.Date(), nullable=False),
        sa.Column('source', sa.String(length=30), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['crop_id'], ['crops.id']),
        sa.ForeignKeyConstraint(['mandi_id'], ['mandis.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_prices_mandi_id'), 'prices', ['mandi_id'], unique=False
    )
    op.create_index(
        op.f('ix_prices_crop_id'), 'prices', ['crop_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_prices_crop_id'), table_name='prices')
    op.drop_index(op.f('ix_prices_mandi_id'), table_name='prices')
    op.drop_table('prices')
    op.drop_table('crops')
    op.drop_table('mandis')
