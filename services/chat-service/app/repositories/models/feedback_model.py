"""SQLAlchemy ORM model for assistant message feedback."""
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, UniqueConstraint, func
from app.repositories.models.base import Base


class FeedbackModel(Base):
    __tablename__ = "feedbacks"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_feedbacks_message_user"),
    )

    id = Column(String(128), primary_key=True)
    message_id = Column(String(128), nullable=False, index=True)
    user_id = Column(String(128), nullable=False, index=True)
    tenant_id = Column(String(128), nullable=True, index=True)
    rating = Column(String(50), nullable=False)
    reason = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )
