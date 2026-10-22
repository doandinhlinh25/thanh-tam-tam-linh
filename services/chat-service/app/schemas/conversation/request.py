"""Conversation request schemas."""
from typing import Optional
from pydantic import BaseModel

class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
