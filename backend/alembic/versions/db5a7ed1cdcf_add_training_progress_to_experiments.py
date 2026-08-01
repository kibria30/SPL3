"""add training progress to experiments

Revision ID: db5a7ed1cdcf
Revises: 312199caf682
Create Date: 2026-08-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'db5a7ed1cdcf'
down_revision: Union[str, Sequence[str], None] = '312199caf682'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('experiments', sa.Column('progress_epoch', sa.Integer(), nullable=True))
    op.add_column('experiments', sa.Column('progress_total_epochs', sa.Integer(), nullable=True))
    op.add_column('experiments', sa.Column('progress_updated_at', sa.DateTime(), nullable=True))
    op.add_column(
        'experiments',
        sa.Column('training_log', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('experiments', 'training_log')
    op.drop_column('experiments', 'progress_updated_at')
    op.drop_column('experiments', 'progress_total_epochs')
    op.drop_column('experiments', 'progress_epoch')
