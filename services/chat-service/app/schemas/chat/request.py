"""Chat request schemas."""

from pydantic import BaseModel, Field


class CourseChatRequest(BaseModel):
    conversation_id: str | None = Field(None, description="Existing conversation UUID, if continuing a thread")
    question: str = Field(..., min_length=1, max_length=4000, description="User's query")
    include_personal_docs: bool = Field(False, description="Whether to include user personal documents in retrieval")
    source_scope: str | None = Field("course_only", description="Knowledge source scope")


class PersonalChatRequest(BaseModel):
    conversation_id: str | None = Field(None, description="Existing conversation UUID, if continuing a thread")
    question: str = Field(..., min_length=1, max_length=4000, description="User's query")
    source_scope: str | None = Field("personal_only", description="Knowledge source scope")
