"""Feedback request schemas matching contracts/openapi/chat.yaml."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FeedbackRequest(BaseModel):
    rating: Literal["positive", "negative"] | int | str = Field(
        ...,
        description="Rating enum 'positive' or 'negative', or numeric rating",
    )
    comment: str | None = Field(None, max_length=2000, description="Optional feedback explanation")
    reason: str | None = Field(None, max_length=255, description="Optional feedback reason")

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: str | int) -> str:
        if isinstance(v, int):
            return "positive" if v >= 3 else "negative"
        val = str(v).lower().strip()
        if val not in ("positive", "negative"):
            raise ValueError("rating must be 'positive' or 'negative'")
        return val


class FeedbackCreateRequest(FeedbackRequest):
    """Backward-compatible request schema."""
    message_id: str | None = None
