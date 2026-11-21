"""Chat controller handling the existing course QA endpoint."""
import re
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.config import Settings, get_settings
from app.dependencies import get_tenant_authorization_client
from app.domain.value_objects.tenant_context import TenantContext
from app.integrations.tenant_authorization.client import TenantAuthorizationClient
from app.integrations.tenant_authorization.errors import (
    csrf_invalid,
    invalid_dependency_response,
    invalid_session,
    origin_invalid,
    validation_error,
)
from app.schemas.chat.request import CourseChatRequest
from app.schemas.chat.response import ChatResponse
from app.services.chat_service import ChatService

router = APIRouter()

_chat_service = ChatService()


def get_chat_service() -> ChatService:
    """Return the chat service used by the course endpoint.

    :returns: The configured Chat service instance.
    """
    return _chat_service


@router.post("/courses/{course_id}/chat", response_model=ChatResponse)
async def ask_course_chat(
    course_id: str,
    payload: CourseChatRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    tenant_client: Annotated[TenantAuthorizationClient, Depends(get_tenant_authorization_client)],
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
) -> ChatResponse:
    """Authorize a course request through Tenant before invoking ChatService.

    :param course_id: Course named in the existing route; it grants no access.
    :param payload: Validated question body; it grants no access.
    :param request: Browser headers used only for selector/session/CSRF transport.
    :param settings: Server-side allowlist configuration.
    :param tenant_client: App-scoped Tenant authorization dependency.
    :param chat_service: Existing Chat application service.
    :raises ChatAuthorizationError: If any authentication or authorization gate fails.
    """
    tenant_id = _validated_tenant_selector(request)
    _validate_origin(request, settings.CORS_ORIGINS)
    _validate_course_id(course_id)
    session_cookie = _token_admin_cookie(request)
    csrf_token = _csrf_header(request)

    context = await tenant_client.resolve_context(
        tenant_id=tenant_id,
        session_cookie=session_cookie,
        csrf_token=csrf_token,
    )
    context_data = context.data
    if context_data.tenant_id.lower() != tenant_id.lower():
        raise invalid_dependency_response()
    if context_data.csrf_verified is not True:
        raise csrf_invalid()

    authorization = await tenant_client.check_course(
        tenant_id=context_data.tenant_id,
        course_id=course_id,
        action="chat:ask",
        session_cookie=session_cookie,
    )
    authorized_data = authorization.data
    if (
        authorized_data.user_id.lower() != context_data.user_id.lower()
        or authorized_data.tenant_id.lower() != context_data.tenant_id.lower()
    ):
        raise invalid_dependency_response()

    trusted_context = TenantContext(
        tenant_id=context_data.tenant_id,
        user_id=context_data.user_id,
        course_id=course_id,
    )
    return await chat_service.answer_question(trusted_context, payload.question)


def _validated_tenant_selector(request: Request) -> str:
    """Read one syntactically valid, explicitly untrusted tenant selector."""
    values = request.headers.getlist("x-tenant-id")
    if len(values) != 1 or re.fullmatch(r"[a-fA-F0-9]{24}", values[0]) is None:
        raise validation_error()
    return values[0]


def _validate_course_id(course_id: str) -> None:
    """Reject a missing/invalid course identifier; Chat never fabricates one."""
    if re.fullmatch(r"[a-fA-F0-9]{24}", course_id) is None:
        raise validation_error()


def _validate_origin(request: Request, allowed_origins: list[str]) -> None:
    """Require exactly one browser Origin matching the configured allowlist."""
    origins = request.headers.getlist("origin")
    if len(origins) != 1 or origins[0] not in allowed_origins:
        raise origin_invalid()


def _token_admin_cookie(request: Request) -> str:
    """Extract and forward only one tokenAdmin cookie; reject ambiguity."""
    values = request.headers.getlist("cookie")
    matches: list[str] = []
    for header in values:
        for pair in header.split(";"):
            name, separator, value = pair.strip().partition("=")
            if name.strip() == "tokenAdmin":
                matches.append(value.strip() if separator else "")

    if len(matches) > 1:
        raise validation_error()
    if not matches or not matches[0]:
        raise invalid_session()
    return f"tokenAdmin={matches[0]}"


def _csrf_header(request: Request) -> str | None:
    """Return one CSRF header; reject multiple values instead of selecting one."""
    values = request.headers.getlist("x-csrf-token")
    if len(values) > 1:
        raise csrf_invalid()
    return values[0] if values else None
