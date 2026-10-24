"""Conversation response schemas."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class MessageSummaryResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

class ConversationSummaryResponse(BaseModel):
    id: str
    title: Optional[str]
    course_id: Optional[str]
    created_at: datetime
    updated_at: datetime

class ConversationDetailResponse(ConversationSummaryResponse):
    messages: List[MessageSummaryResponse] = []
