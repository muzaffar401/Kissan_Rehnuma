"""Create voice helpline tables.

Revision ID: 20260828_0001
Revises:
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260828_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

session_status = sa.Enum(
    "PENDING", "ACTIVE", "COMPLETED", "FAILED", "EXPIRED", name="helpline_session_status"
)
complaint_urgency = sa.Enum("LOW", "NORMAL", "HIGH", name="complaint_urgency")
complaint_status = sa.Enum(
    "REGISTERED", "IN_REVIEW", "RESOLVED", "CLOSED", name="complaint_status"
)


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "helpline_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("farmer_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_room_name", sa.String(255)),
        sa.Column("participant_name", sa.String(120), nullable=False),
        sa.Column("language", sa.String(16), nullable=False),
        sa.Column("status", session_status, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("failure_code", sa.String(80)),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_helpline_sessions"),
        sa.UniqueConstraint("provider_room_name", name="uq_helpline_sessions_provider_room_name"),
    )
    op.create_index("ix_helpline_sessions_farmer_id", "helpline_sessions", ["farmer_id"])
    op.create_index("ix_helpline_sessions_status", "helpline_sessions", ["status"])

    op.create_table(
        "complaints",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reference_number", sa.String(32), nullable=False),
        sa.Column("farmer_id", sa.Uuid(), nullable=False),
        sa.Column("helpline_session_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("crop", sa.String(100)),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("district", sa.String(100)),
        sa.Column("urgency", complaint_urgency, nullable=False),
        sa.Column("status", complaint_status, nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["helpline_session_id"], ["helpline_sessions.id"], ondelete="RESTRICT",
            name="fk_complaints_helpline_session_id_helpline_sessions"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_complaints"),
        sa.UniqueConstraint("reference_number", name="uq_complaints_reference_number"),
    )
    op.create_index("ix_complaints_farmer_id", "complaints", ["farmer_id"])
    op.create_index("ix_complaints_helpline_session_id", "complaints", ["helpline_session_id"])
    op.create_index("ix_complaints_reference_number", "complaints", ["reference_number"])
    op.create_index("ix_complaints_status", "complaints", ["status"])

    op.create_table(
        "complaint_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("previous_status", sa.String(32)),
        sa.Column("new_status", sa.String(32)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_by", sa.Uuid()),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["complaint_id"], ["complaints.id"], ondelete="CASCADE",
            name="fk_complaint_events_complaint_id_complaints"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_complaint_events"),
    )
    op.create_index("ix_complaint_events_complaint_id", "complaint_events", ["complaint_id"])

    op.create_table(
        "tool_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("farmer_id", sa.Uuid(), nullable=False),
        sa.Column("helpline_session_id", sa.Uuid(), nullable=False),
        sa.Column("tool_name", sa.String(80), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("response_payload", sa.JSON()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("error_code", sa.String(80)),
        sa.Column("duration_ms", sa.Integer()),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["helpline_session_id"], ["helpline_sessions.id"], ondelete="CASCADE",
            name="fk_tool_executions_helpline_session_id_helpline_sessions"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tool_executions"),
        sa.UniqueConstraint(
            "farmer_id", "idempotency_key", name="uq_tool_executions_farmer_id"
        ),
    )
    op.create_index("ix_tool_executions_farmer_id", "tool_executions", ["farmer_id"])
    op.create_index(
        "ix_tool_executions_helpline_session_id",
        "tool_executions",
        ["helpline_session_id"],
    )


def downgrade() -> None:
    op.drop_table("tool_executions")
    op.drop_table("complaint_events")
    op.drop_table("complaints")
    op.drop_table("helpline_sessions")
    complaint_status.drop(op.get_bind(), checkfirst=True)
    complaint_urgency.drop(op.get_bind(), checkfirst=True)
    session_status.drop(op.get_bind(), checkfirst=True)
