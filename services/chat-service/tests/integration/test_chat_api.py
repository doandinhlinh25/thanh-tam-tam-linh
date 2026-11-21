"""ASGI regression tests for the existing course chat authorization boundary."""
from unittest.mock import AsyncMock

import httpx
import pytest

from app.api.controllers.chat_controller import get_chat_service
from app.core.config import Settings, get_settings
from app.dependencies import get_tenant_authorization_client
from app.main import app

CHAT_ROUTE = "/api/v1/courses/course-101/chat"
VALID_QUESTION = {"question": "Học phần này có mấy tín chỉ?"}


@pytest.mark.asyncio
@pytest.mark.parametrize("extra_headers", [{}, {"X-User-Id": "user-xyz"}, {"Authorization": "Bearer forged"}])
async def test_course_chat_fails_closed_when_tenant_client_is_unavailable(extra_headers):
    """Browser identity claims cannot bypass the unavailable Tenant dependency."""
    mock_service = AsyncMock()
    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {
                "Origin": "http://localhost:3000",
                "X-Tenant-Id": "bbbbbbbbbbbbbbbbbbbbbbbb",
                "Cookie": "tokenAdmin=user-session",
                **extra_headers,
            }
            response = await client.post(CHAT_ROUTE, json=VALID_QUESTION, headers=headers)

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "AUTH_DEPENDENCY_FAILURE"
        mock_service.answer_question.assert_not_called()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_course_chat_still_validates_empty_question():
    """The existing question schema rejects empty input before Tenant is called."""
    tenant_client = AsyncMock()
    mock_service = AsyncMock()
    app.dependency_overrides[get_settings] = lambda: Settings(
        tenant_service_url="https://tenant.invalid",
        chat_service_token="t" * 40,
        cors_origins=["http://localhost:3000"],
    )
    app.dependency_overrides[get_tenant_authorization_client] = lambda: tenant_client
    app.dependency_overrides[get_chat_service] = lambda: mock_service
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            CHAT_ROUTE,
            json={"question": ""},
            headers={
                "Origin": "http://localhost:3000",
                "X-Tenant-Id": "bbbbbbbbbbbbbbbbbbbbbbbb",
                "Cookie": "tokenAdmin=session",
            },
        )

    assert response.status_code == 422
    tenant_client.resolve_context.assert_not_awaited()
    mock_service.answer_question.assert_not_awaited()
    app.dependency_overrides.clear()
