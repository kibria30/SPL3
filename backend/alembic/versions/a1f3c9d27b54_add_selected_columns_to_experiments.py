"""add selected_columns to experiments

Revision ID: a1f3c9d27b54
Revises: db5a7ed1cdcf
Create Date: 2026-10-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1f3c9d27b54'
down_revision: Union[str, Sequence[str], None] = 'db5a7ed1cdcf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('experiments', sa.Column('selected_columns', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('experiments', 'selected_columns')
