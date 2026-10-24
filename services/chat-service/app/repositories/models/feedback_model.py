"""SQLAlchemy ORM model for assistant message feedback."""
from sqlalchemy import Column, String, Integer, Text, DateTime, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class FeedbackModel(Base):
    __tablename__ = "feedbacks"

    id = Column(String(36), primary_key=True)
    message_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(128), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
