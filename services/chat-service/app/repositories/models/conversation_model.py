"""SQLAlchemy ORM model for conversations."""
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class ConversationModel(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(128), nullable=False, index=True)
    user_id = Column(String(128), nullable=False, index=True)
    course_id = Column(String(128), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
