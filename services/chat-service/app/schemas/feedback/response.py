"""Feedback response schemas matching contracts/openapi/chat.yaml."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, model_validator


class FeedbackResult(BaseModel):
    feedback_id: str
    message_id: str
    rating: str
    created_at: datetime
    # Backward compatibility aliases
    id: Optional[str] = None

    @model_validator(mode="after")
    def populate_id(self):
        if self.id is None:
            self.id = self.feedback_id
        return self


class FeedbackEnvelope(BaseModel):
    successful: bool = True
    data: FeedbackResult
    error: Optional[Any] = None


# Backward-compatible alias
class FeedbackResponse(BaseModel):
    id: str
    message_id: str
    rating: Any
    created_at: datetime
