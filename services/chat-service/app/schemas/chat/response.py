"""Chat response schemas matching contracts/openapi/chat.yaml and backward compatibility."""
from typing import List, Optional, Any
from pydantic import BaseModel, Field, model_validator


class CitationSchema(BaseModel):
    document_id: str
    chunk_id: str
    title: str
    page_number: Optional[int] = None
    snippet: str
    citation_id: Optional[str] = None
    evidence_id: Optional[str] = None
    source_type: Optional[str] = "official"
    document_name: Optional[str] = None
    page_from: Optional[int] = None
    page_to: Optional[int] = None

    @model_validator(mode="after")
    def populate_fields(self):
        if not self.evidence_id:
            self.evidence_id = self.chunk_id
        if not self.chunk_id:
            self.chunk_id = self.evidence_id
        if not self.document_name:
            self.document_name = self.title
        if not self.title:
            self.title = self.document_name
        if self.page_from is None:
            self.page_from = self.page_number or 1
        if self.page_to is None:
            self.page_to = self.page_from
        if self.page_number is None:
            self.page_number = self.page_from
        if not self.citation_id:
            self.citation_id = f"cit-{self.evidence_id}"
        return self


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str
    refused: bool = False
    refusal_reason: Optional[str] = None
    citations: List[CitationSchema] = Field(default_factory=list)
    status: Optional[str] = None
    source_scope: Optional[str] = "course_only"
    pipeline: Optional[dict] = None
    request_id: Optional[str] = None
    successful: Optional[bool] = None
    data: Optional[dict] = None
    error: Optional[Any] = None

    @model_validator(mode="after")
    def populate_envelope(self):
        if self.status is None:
            self.status = "insufficient_evidence" if self.refused else "answered"
        if self.successful is None:
            self.successful = True
        if not self.data:
            self.data = {
                "request_id": self.request_id or "",
                "conversation_id": self.conversation_id,
                "message_id": self.message_id,
                "status": self.status,
                "source_scope": self.source_scope or "course_only",
                "answer": self.answer,
                "citations": [
                    c.model_dump() if hasattr(c, "model_dump") else dict(c)
                    for c in self.citations
                ],
                "pipeline": self.pipeline or {},
            }
        return self
