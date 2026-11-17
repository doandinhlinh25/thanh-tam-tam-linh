"""Conversation request schemas."""

from pydantic import BaseModel


class ConversationUpdateRequest(BaseModel):
    title: str | None = None
