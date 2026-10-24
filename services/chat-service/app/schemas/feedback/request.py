"""Feedback request schemas."""
from typing import Optional
from pydantic import BaseModel, Field

class FeedbackCreateRequest(BaseModel):
    message_id: str
    rating: int = Field(..., ge=1, le=5, description="1 to 5 rating scale or binary thumb")
    comment: Optional[str] = None
