"""Feedback controller for user rating/corrections on assistant answers."""
from fastapi import APIRouter, Depends, Header

from app.core.exceptions import UnauthorizedException
from app.dependencies import get_uow
from app.integrations.database.unit_of_work import UnitOfWork
from app.schemas.feedback.request import FeedbackCreateRequest, FeedbackRequest
from app.schemas.feedback.response import FeedbackEnvelope
from app.services.feedback_service import FeedbackService

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


def get_feedback_service(uow: UnitOfWork = _UOW_DEPENDENCY) -> FeedbackService:
    return FeedbackService(
        feedback_repo=uow.feedbacks,
        message_repo=uow.messages,
        uow=uow,
    )


_AUTH_CONTEXT_DEPENDENCY = Depends(get_auth_context)
_FEEDBACK_SERVICE_DEPENDENCY = Depends(get_feedback_service)


@router.post("/messages/{messageId}/feedback", response_model=FeedbackEnvelope)
async def submit_message_feedback(
    messageId: str,
    payload: FeedbackRequest,
    auth: tuple[str, str] = _AUTH_CONTEXT_DEPENDENCY,
    service: FeedbackService = _FEEDBACK_SERVICE_DEPENDENCY,
):
    """Create or update feedback for an assistant message."""
    tenant_id, user_id = auth
    return await service.submit_feedback(
        message_id=messageId,
        user_id=user_id,
        tenant_id=tenant_id,
        rating=payload.rating,
        comment=payload.comment,
        reason=payload.reason,
    )


@router.post("/feedback", response_model=FeedbackEnvelope)
async def submit_feedback_legacy(
    payload: FeedbackCreateRequest,
    auth: tuple[str, str] = _AUTH_CONTEXT_DEPENDENCY,
    service: FeedbackService = _FEEDBACK_SERVICE_DEPENDENCY,
):
    """Legacy feedback submission endpoint."""
    tenant_id, user_id = auth
    return await service.submit_feedback(
        message_id=payload.message_id or "",
        user_id=user_id,
        tenant_id=tenant_id,
        rating=payload.rating,
        comment=payload.comment,
    )
