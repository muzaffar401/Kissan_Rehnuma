"""add price columns and seed Punjab mandis

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Major Punjab mandi markets (from AMIS 36 district markets)
PUNJAB_MANDIS = [
    ("Lahore", "Lahore"),
    ("Multan", "Multan"),
    ("Faisalabad", "Faisalabad"),
    ("Rawalpindi", "Rawalpindi"),
    ("Gujranwala", "Gujranwala"),
    ("Sialkot", "Sialkot"),
    ("Sargodha", "Sargodha"),
    ("Bahawalpur", "Bahawalpur"),
    ("Dera Ghazi Khan", "Dera Ghazi Khan"),
    ("Sahiwal", "Sahiwal"),
    ("Jhang", "Jhang"),
    ("Sheikhupura", "Sheikhupura"),
    ("Gujrat", "Gujrat"),
    ("Muzaffargarh", "Muzaffargarh"),
    ("Kasur", "Kasur"),
    ("Okara", "Okara"),
    ("Vehari", "Vehari"),
    ("Mianwali", "Mianwali"),
    ("Rahim Yar Khan", "Rahim Yar Khan"),
    ("Khushab", "Khushab"),
    ("Attock", "Attock"),
    ("Chakwal", "Chakwal"),
    ("Bhakkar", "Bhakkar"),
    ("Layyah", "Layyah"),
    ("Khanewal", "Khanewal"),
    ("Lodhran", "Lodhran"),
    ("Pakpattan", "Pakpattan"),
    ("Hafizabad", "Hafizabad"),
    ("Mandi Bahauddin", "Mandi Bahauddin"),
    ("Narowal", "Narowal"),
    ("Toba Tek Singh", "Toba Tek Singh"),
    ("Chiniot", "Chiniot"),
    ("Nankana Sahib", "Nankana Sahib"),
    ("Talagang", "Talagang"),
    ("Jhelum", "Jhelum"),
    ("Rajanpur", "Rajanpur"),
]


def upgrade() -> None:
    # Add min/max/fqp price columns
    op.add_column('prices', sa.Column('min_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('prices', sa.Column('max_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('prices', sa.Column('fqp_price', sa.Numeric(10, 2), nullable=True))

    # Seed Punjab mandis
    mandis_table = sa.table('mandis',
        sa.column('name', sa.String),
        sa.column('city', sa.String),
    )
    for name, city in PUNJAB_MANDIS:
        op.execute(
            mandis_table.insert().values(name=name, city=city)
        )


def downgrade() -> None:
    op.drop_column('prices', 'fqp_price')
    op.drop_column('prices', 'max_price')
    op.drop_column('prices', 'min_price')
    # Remove seeded mandis
    for name, city in PUNJAB_MANDIS:
        op.execute(
            f"DELETE FROM mandis WHERE name = '{name}' AND city = '{city}'"
        )
