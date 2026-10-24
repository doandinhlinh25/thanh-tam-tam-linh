"""Chat controller handling RAG QA endpoints."""
import uuid
from typing import Optional
from fastapi import APIRouter, Header, Depends
from app.schemas.chat.request import CourseChatRequest
from app.schemas.chat.response import ChatResponse, CitationSchema
from app.services.chat_service import ChatService
from app.domain.value_objects.tenant_context import TenantContext

router = APIRouter()

_chat_service = ChatService()


def get_chat_service() -> ChatService:
    return _chat_service


@router.post("/courses/{course_id}/chat", response_model=ChatResponse)
async def ask_course_chat(
    course_id: str,
    payload: CourseChatRequest,
    x_request_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Ask a question using authorized course and personal documents."""
    req_id = x_request_id or f"req-{uuid.uuid4().hex[:12]}"
    tenant_id = x_tenant_id or "default-tenant"
    user_id = x_user_id or "anonymous-user"

    context = TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        course_id=course_id,
    )

    result = await chat_service.answer_question(context, payload.question)

    citations = [
        CitationSchema(
            document_id=c.document_id,
            chunk_id=c.evidence_id,
            title=c.document_name,
            page_number=c.page_from,
            snippet=c.snippet,
        )
        for c in result.citations
    ]

    is_refused = (result.status == "insufficient_evidence")

    return ChatResponse(
        conversation_id=payload.conversation_id or f"conv-{uuid.uuid4().hex[:12]}",
        message_id=f"msg-{uuid.uuid4().hex[:12]}",
        answer=result.answer,
        refused=is_refused,
        refusal_reason="insufficient_evidence" if is_refused else None,
        citations=citations,
    )
