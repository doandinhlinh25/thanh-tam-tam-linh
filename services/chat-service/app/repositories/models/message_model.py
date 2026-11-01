"""SQLAlchemy ORM model for chat messages."""
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Boolean, JSON, func
from app.repositories.models.base import Base


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(String(128), primary_key=True)
    conversation_id = Column(String(128), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(50), nullable=True)
    refused = Column(Boolean, nullable=False, default=False)
    refusal_reason = Column(String(255), nullable=True)
    citations = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
