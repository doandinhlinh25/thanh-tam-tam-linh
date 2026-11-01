"""SQLAlchemy ORM model for conversations."""
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, func
from app.repositories.models.base import Base


class ConversationModel(Base):
    __tablename__ = "conversations"

    id = Column(String(128), primary_key=True)
    tenant_id = Column(String(128), nullable=False, index=True)
    user_id = Column(String(128), nullable=False, index=True)
    course_id = Column(String(128), nullable=True, index=True)
    source_scope = Column(String(50), nullable=False, default="course_only")
    title = Column(String(255), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
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
        nullable=False,
    )
    last_message_at = Column(DateTime(timezone=True), nullable=True)
