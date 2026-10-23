"""Data schemas for retrieval requests and evidence payloads."""
import uuid
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class SearchRequest(BaseModel):
    """Structured request conforming to Document Service OpenAPI search contract."""
    model_config = ConfigDict(populate_by_name=True)

    tenant_id: str = Field(alias="tenantId")
    course_id: str = Field(default="", alias="courseId")
    actor_user_id: str = Field(default="", alias="actorUserId")
    query: str
    candidate_k: int = Field(default=8, alias="candidateK")
    request_id: Optional[str] = Field(default=None, alias="requestId")
    expected_index_version: Optional[str] = Field(default=None, alias="expectedIndexVersion")

    def to_payload(self) -> dict[str, Any]:
        """Convert to strict camelCase payload expected by Document Service."""
        payload: dict[str, Any] = {
            "tenantId": self.tenant_id,
            "courseId": self.course_id,
            "actorUserId": self.actor_user_id,
            "query": self.query,
            "candidateK": self.candidate_k,
            "requestId": self.request_id or f"req-{uuid.uuid4().hex[:12]}",
        }
        if self.expected_index_version is not None:
            payload["expectedIndexVersion"] = self.expected_index_version
        return payload


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
