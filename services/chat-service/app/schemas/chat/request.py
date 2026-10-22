"""Chat request schemas."""
from typing import Optional
from pydantic import BaseModel, Field

class CourseChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(None, description="Existing conversation UUID, if continuing a thread")
    question: str = Field(..., min_length=1, max_length=4000, description="User's query")
    include_personal_docs: bool = Field(False, description="Whether to include user personal documents in retrieval")
