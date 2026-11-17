"""Conversation response schemas matching contracts/openapi/chat.yaml."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class ChatCitationSchema(BaseModel):
    citation_id: str
    evidence_id: str
    source_type: str = "official"
    document_id: str
    document_name: str
    page_from: int
    page_to: int
    snippet: str
    # Backward compatibility aliases
    chunk_id: str | None = None
    title: str | None = None
    page_number: int | None = None

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.chunk_id:
            self.chunk_id = self.evidence_id
        if not self.title:
            self.title = self.document_name
        if self.page_number is None:
            self.page_number = self.page_from
        return self


class ChatMessageResponse(BaseModel):
    message_id: str
    role: str
    content: str
    status: str | None = None
    citations: list[ChatCitationSchema] = Field(default_factory=list)
    created_at: datetime


class ConversationSummaryResponse(BaseModel):
    conversation_id: str
    course_id: str | None = None
    source_scope: str = "course_only"
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None
    id: str | None = None

    @model_validator(mode="after")
    def populate_id(self):
        if self.id is None:
            self.id = self.conversation_id
        return self


class ConversationListResponse(BaseModel):
    items: list[ConversationSummaryResponse] = Field(default_factory=list)
    next_cursor: str | None = None


class ConversationListEnvelope(BaseModel):
    successful: bool = True
    data: ConversationListResponse
    error: Any | None = None


class ConversationDetailResponse(BaseModel):
    conversation_id: str
    course_id: str | None = None
    source_scope: str = "course_only"
    title: str | None = None
    messages: list[ChatMessageResponse] = Field(default_factory=list)
    next_cursor: str | None = None
    created_at: datetime
    updated_at: datetime
    id: str | None = None

    @model_validator(mode="after")
    def populate_id(self):
        if self.id is None:
            self.id = self.conversation_id
        return self


class ConversationDetailEnvelope(BaseModel):
    successful: bool = True
    data: ConversationDetailResponse
    error: Any | None = None


class ConversationDeletionResult(BaseModel):
    conversation_id: str
    deleted: bool = True


class ConversationDeletionEnvelope(BaseModel):
    successful: bool = True
    data: ConversationDeletionResult
    error: Any | None = None
