"""Chat response schemas."""
from typing import List, Optional
from pydantic import BaseModel, Field

class CitationSchema(BaseModel):
    document_id: str
    chunk_id: str
    title: str
    page_number: Optional[int] = None
    snippet: str

class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str
    refused: bool = False
    refusal_reason: Optional[str] = None
    citations: List[CitationSchema] = Field(default_factory=list)
