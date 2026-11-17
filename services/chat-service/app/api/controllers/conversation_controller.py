"""Conversation controller for managing user chat history."""

from fastapi import APIRouter, Depends, Header, Query

from app.core.exceptions import UnauthorizedException
from app.dependencies import get_uow
from app.integrations.database.unit_of_work import UnitOfWork
from app.schemas.conversation.response import (
    ConversationDeletionEnvelope,
    ConversationDetailEnvelope,
    ConversationListEnvelope,
)
from app.services.conversation_service import ConversationService

router = APIRouter()
_UOW_DEPENDENCY = Depends(get_uow)


def get_auth_context(
    x_tenant_id: str | None = Header(None),
    x_user_id: str | None = Header(None),
) -> tuple[str, str]:
    """Validate authenticated user session or trusted identity headers."""
    if not x_user_id:
        raise UnauthorizedException("Authentication required")
    tenant_id = x_tenant_id or "default-tenant"
    return tenant_id, x_user_id


def get_conversation_service(uow: UnitOfWork = _UOW_DEPENDENCY) -> ConversationService:
    return ConversationService(
        conversation_repo=uow.conversations,
        message_repo=uow.messages,
        feedback_repo=uow.feedbacks,
        uow=uow,
    )


_AUTH_CONTEXT_DEPENDENCY = Depends(get_auth_context)
_CONVERSATION_SERVICE_DEPENDENCY = Depends(get_conversation_service)


@router.get("", response_model=ConversationListEnvelope)
async def list_conversations(
    course_id: str | None = Query(None),
    source_scope: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    auth: tuple[str, str] = _AUTH_CONTEXT_DEPENDENCY,
    service: ConversationService = _CONVERSATION_SERVICE_DEPENDENCY,
):
    """List conversations owned by authenticated user."""
    tenant_id, user_id = auth
    return await service.list_conversations(
        tenant_id=tenant_id,
        user_id=user_id,
        course_id=course_id,
        source_scope=source_scope,
        limit=limit,
        cursor=cursor,
    )


@router.get("/{conversationId}", response_model=ConversationDetailEnvelope)
async def get_conversation(
    conversationId: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    auth: tuple[str, str] = _AUTH_CONTEXT_DEPENDENCY,
    service: ConversationService = _CONVERSATION_SERVICE_DEPENDENCY,
):
    """Get conversation details and messages verifying owner access."""
    tenant_id, user_id = auth
    return await service.get_conversation(
        tenant_id=tenant_id,
        user_id=user_id,
        conversation_id=conversationId,
        limit=limit,
        cursor=cursor,
    )


@router.delete("/{conversationId}", response_model=ConversationDeletionEnvelope)
async def delete_conversation(
    conversationId: str,
    auth: tuple[str, str] = _AUTH_CONTEXT_DEPENDENCY,
    service: ConversationService = _CONVERSATION_SERVICE_DEPENDENCY,
):
    """Delete a conversation owned by the authenticated user."""
    tenant_id, user_id = auth
    return await service.delete_conversation(
        tenant_id=tenant_id,
        user_id=user_id,
        conversation_id=conversationId,
    )
