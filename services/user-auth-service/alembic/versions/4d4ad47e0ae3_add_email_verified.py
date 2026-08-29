"""add email verified

Revision ID: 4d4ad47e0ae3
Revises: 8455464bc234
Create Date: 2026-...
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4d4ad47e0ae3"
down_revision: Union[str, Sequence[str], None] = "8455464bc234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "farmers",
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false()
        )
    )


def downgrade() -> None:
    op.drop_column("farmers", "email_verified")