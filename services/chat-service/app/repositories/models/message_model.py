"""SQLAlchemy ORM model for chat messages."""
from sqlalchemy import Column, String, DateTime, Text, Boolean, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    refused = Column(Boolean, default=False)
    refusal_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
