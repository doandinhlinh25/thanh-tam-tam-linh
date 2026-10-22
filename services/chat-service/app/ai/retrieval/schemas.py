"""Data schemas for retrieval requests and evidence payloads."""
from typing import List, Optional
from pydantic import BaseModel

class RetrievalRequest(BaseModel):
    query: str
    tenant_id: str
    course_id: Optional[str] = None
    user_id: Optional[str] = None
    top_k: int = 8

class RetrievedChunkSchema(BaseModel):
    chunk_id: str
    document_id: str
    source_title: str
    content: str
    score: float
    page_number: Optional[int] = None

class RetrievalResponse(BaseModel):
    chunks: List[RetrievedChunkSchema]
