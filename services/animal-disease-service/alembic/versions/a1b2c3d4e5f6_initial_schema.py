"""initial schema

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-08-28 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('animal_disease_logs',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('image_url', sa.Text(), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=True),
    sa.Column('language', sa.String(length=5), nullable=False),
    sa.Column('is_animal', sa.Boolean(), nullable=False),
    sa.Column('animal_type', sa.String(length=255), nullable=True),
    sa.Column('disease_name', sa.String(length=255), nullable=True),
    sa.Column('scientific_name', sa.String(length=255), nullable=True),
    sa.Column('confidence', sa.Float(), nullable=True),
    sa.Column('symptoms', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('causes', sa.Text(), nullable=True),
    sa.Column('treatment', sa.Text(), nullable=True),
    sa.Column('prevention_tips', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('affected_species', sa.Text(), nullable=True),
    sa.Column('status', sa.Enum('COMPLETED', 'LOW_CONFIDENCE', 'NOT_AN_ANIMAL', 'FAILED', name='animal_scan_status'), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_animal_disease_logs_user_id'), 'animal_disease_logs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_animal_disease_logs_user_id'), table_name='animal_disease_logs')
    op.drop_table('animal_disease_logs')
