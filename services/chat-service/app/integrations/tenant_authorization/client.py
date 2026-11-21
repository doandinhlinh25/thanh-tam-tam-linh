"""Async HTTPX client for the Tenant internal Chat authorization contract."""

from typing import Protocol

import httpx
from pydantic import ValidationError

from app.integrations.tenant_authorization.errors import (
    authorization_timeout,
    dependency_unavailable,
    invalid_dependency_response,
    map_upstream_failure,
    validation_error,
)
from app.integrations.tenant_authorization.schemas import (
    AuthorizationAction,
    ContextRequest,
    ContextSuccess,
    CourseAuthorizationRequest,
    CourseAuthorizationSuccess,
)


class AsyncPostClient(Protocol):
    """Minimal HTTPX surface used by the authorization client and its tests."""

    async def post(self, url: str, *, json: dict, headers: dict[str, str]) -> httpx.Response:
        """Send one POST without managing client lifecycle."""


class TenantAuthorizationClient:
    """Calls Tenant context and course authorization with server credentials.

    :param base_url: Tenant service origin without an internal route suffix.
    :param service_token: Server-side CHAT_SERVICE_TOKEN.
    :param http_client: App-scoped HTTPX client managed by FastAPI lifespan.
    """

    def __init__(self, base_url: str, service_token: str, http_client: AsyncPostClient) -> None:
        self._base_url = base_url.rstrip("/")
        self._service_token = service_token
        self._http_client = http_client

    async def resolve_context(
        self,
        *,
        tenant_id: str,
        session_cookie: str,
        csrf_token: str | None,
    ) -> ContextSuccess:
        """Resolve Auth identity and selected active tenant membership.

        :param tenant_id: Untrusted tenant selector, validated by Chat and Tenant.
        :param session_cookie: Cookie header containing only tokenAdmin.
        :param csrf_token: Optional raw browser CSRF header, forwarded only here.
        :returns: Strictly validated Tenant context success envelope.
        :raises ChatAuthorizationError: On any rejected or malformed dependency response.
        """
        try:
            request = ContextRequest(tenantId=tenant_id)
        except ValidationError:
            raise validation_error() from None
        headers = self._headers(session_cookie)
        if csrf_token is not None:
            headers["X-CSRF-Token"] = csrf_token
        response = await self._post(
            "/internal/authorization/context",
            request.model_dump(by_alias=True),
            headers,
        )
        try:
            return ContextSuccess.model_validate(response.json())
        except (ValueError, ValidationError, TypeError):
            raise invalid_dependency_response() from None

    async def check_course(
        self,
        *,
        tenant_id: str,
        course_id: str,
        action: AuthorizationAction,
        session_cookie: str,
    ) -> CourseAuthorizationSuccess:
        """Check an existing course permission with the verified session.

        :param tenant_id: Canonical tenant ID returned by context.
        :param course_id: Course ID from the Chat route; never fabricated.
        :param action: Contract action, fixed to chat:ask by course chat.
        :param session_cookie: Cookie header containing only tokenAdmin.
        :returns: Strictly validated Tenant course authorization success.
        :raises ChatAuthorizationError: On any rejected or malformed dependency response.
        """
        try:
            request = CourseAuthorizationRequest(
                tenantId=tenant_id,
                courseId=course_id,
                action=action,
            )
        except ValidationError:
            raise validation_error() from None
        response = await self._post(
            "/internal/authorization/check",
            request.model_dump(by_alias=True),
            self._headers(session_cookie),
        )
        try:
            return CourseAuthorizationSuccess.model_validate(response.json())
        except (ValueError, ValidationError, TypeError):
            raise invalid_dependency_response() from None

    async def _post(
        self,
        path: str,
        payload: dict,
        headers: dict[str, str],
    ) -> httpx.Response:
        headers["Authorization"] = f"Bearer {self._service_token}"
        headers["Content-Type"] = "application/json"
        try:
            response = await self._http_client.post(
                f"{self._base_url}{path}",
                json=payload,
                headers=headers,
            )
        except httpx.TimeoutException:
            raise authorization_timeout() from None
        except httpx.RequestError:
            raise dependency_unavailable() from None

        if response.status_code != 200:
            try:
                body = response.json()
            except (ValueError, TypeError):
                body = None
            raise map_upstream_failure(response.status_code, body)
        return response

    @staticmethod
    def _headers(session_cookie: str) -> dict[str, str]:
        """Build a minimal forwarding header set without browser identity headers."""
        return {"Cookie": session_cookie}
