"""Chat controller handling RAG QA endpoints."""
import uuid
from typing import Optional, Any
from fastapi import APIRouter, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_session
from app.integrations.database.unit_of_work import UnitOfWork
from app.schemas.chat.request import CourseChatRequest, PersonalChatRequest
from app.schemas.chat.response import ChatResponse, CitationSchema
from app.services.chat_service import ChatService
from app.domain.value_objects.tenant_context import TenantContext

router = APIRouter()

_chat_service = ChatService()


def _get_attr_or_key(obj: Any, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if isinstance(obj, dict):
            if k in obj and obj[k] is not None:
                return obj[k]
        elif hasattr(obj, k):
            v = getattr(obj, k)
            if v is not None:
                return v
    return default


def _extract_citation_schema(c: Any, default_source: str = "official") -> CitationSchema:
    ev_id = _get_attr_or_key(c, "evidence_id", "chunk_id", "evidenceId", default="")
    doc_id = _get_attr_or_key(c, "document_id", "documentId", default="")
    doc_name = _get_attr_or_key(c, "document_name", "title", "documentName", default="")
    p_from = _get_attr_or_key(c, "page_from", "page_number", "pageFrom", default=1)
    p_to = _get_attr_or_key(c, "page_to", "page_number", "pageTo", default=p_from)
    snippet = _get_attr_or_key(c, "snippet", default="")
    cit_id = _get_attr_or_key(c, "citation_id", "citationId", default=None)
    src_type = _get_attr_or_key(c, "source_type", "sourceType", default=default_source)
    return CitationSchema(
        document_id=doc_id,
        chunk_id=ev_id,
        title=doc_name,
        page_number=p_from,
        snippet=snippet,
        citation_id=cit_id,
        evidence_id=ev_id,
        source_type=src_type,
        document_name=doc_name,
        page_from=p_from,
        page_to=p_to,
    )


def get_chat_service(session: Optional[AsyncSession] = Depends(get_session)) -> ChatService:
    if session:
        uow = UnitOfWork(session)
        return ChatService(
            uow=uow,
            conversation_repo=uow.conversations,
            message_repo=uow.messages,
        )
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
        request_id=req_id,
    )

    scope = payload.source_scope or ("combined" if payload.include_personal_docs else "course_only")

    # Pass question, and if conversation_id is present or service accepts it
    try:
        result = await chat_service.answer_question(
            context=context,
            question=payload.question,
            conversation_id=payload.conversation_id,
            source_scope=scope,
        )
    except TypeError:
        # Backward compatibility for mocks or services accepting only (context, question)
        result = await chat_service.answer_question(context, payload.question)

    citations = [_extract_citation_schema(c, default_source="official") for c in result.citations]

    is_refused = (
        getattr(result, "status", "") == "insufficient_evidence"
        or getattr(result, "result_state", "") == "insufficient_evidence"
        or getattr(result, "refused", False)
    )

    conv_id = (
        getattr(result, "conversation_id", None)
        or payload.conversation_id
        or f"conv-{uuid.uuid4().hex[:12]}"
    )
    msg_id = getattr(result, "message_id", None) or f"msg-{uuid.uuid4().hex[:12]}"

    return ChatResponse(
        conversation_id=conv_id,
        message_id=msg_id,
        answer=result.answer,
        refused=is_refused,
        refusal_reason="insufficient_evidence" if is_refused else None,
        citations=citations,
        status="insufficient_evidence" if is_refused else "answered",
        source_scope=scope,
        pipeline=getattr(result, "metadata", None),
        request_id=req_id,
        successful=True,
        data=getattr(result, "data", None),
    )


@router.post("/personal-documents/chat", response_model=ChatResponse)
async def ask_personal_chat(
    payload: PersonalChatRequest,
    x_request_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Ask a question using the caller's personal documents."""
    req_id = x_request_id or f"req-{uuid.uuid4().hex[:12]}"
    tenant_id = x_tenant_id or "default-tenant"
    user_id = x_user_id or "anonymous-user"

    context = TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        course_id=None,
        request_id=req_id,
    )

    try:
        result = await chat_service.answer_question(
            context=context,
            question=payload.question,
            conversation_id=payload.conversation_id,
            source_scope="personal_only",
        )
    except TypeError:
        result = await chat_service.answer_question(context, payload.question)

    citations = [_extract_citation_schema(c, default_source="personal") for c in result.citations]

    is_refused = (
        getattr(result, "status", "") == "insufficient_evidence"
        or getattr(result, "result_state", "") == "insufficient_evidence"
        or getattr(result, "refused", False)
    )

    conv_id = (
        getattr(result, "conversation_id", None)
        or payload.conversation_id
        or f"conv-{uuid.uuid4().hex[:12]}"
    )
    msg_id = getattr(result, "message_id", None) or f"msg-{uuid.uuid4().hex[:12]}"

    return ChatResponse(
        conversation_id=conv_id,
        message_id=msg_id,
        answer=result.answer,
        refused=is_refused,
        refusal_reason="insufficient_evidence" if is_refused else None,
        citations=citations,
        status="insufficient_evidence" if is_refused else "answered",
        source_scope="personal_only",
        pipeline=getattr(result, "metadata", None),
        request_id=req_id,
        successful=True,
        data=getattr(result, "data", None),
    )
