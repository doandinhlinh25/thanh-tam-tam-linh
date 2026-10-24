"""Feedback response schemas."""
from datetime import datetime
from pydantic import BaseModel

class FeedbackResponse(BaseModel):
    id: str
    message_id: str
    rating: int
    created_at: datetime
