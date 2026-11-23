"""ASGI regression tests for the existing course chat authorization boundary."""
import httpx
import pytest
from unittest.mock import AsyncMock

from app.api.controllers.chat_controller import get_chat_service
from app.main import app


CHAT_ROUTE = "/api/v1/courses/course-101/chat"
VALID_QUESTION = {"question": "Học phần này có mấy tín chỉ?"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"X-Tenant-Id": "tenant-abc", "X-User-Id": "user-xyz"},
        {"Authorization": "Bearer forged", "X-Tenant-Id": "tenant-abc"},
    ],
)
async def test_course_chat_fails_closed_without_trusted_identity(headers):
    """Untrusted headers cannot reach ChatService while auth is unavailable."""
    mock_service = AsyncMock()
    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(CHAT_ROUTE, json=VALID_QUESTION, headers=headers)

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"
        mock_service.answer_question.assert_not_called()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_course_chat_still_validates_empty_question():
    """The existing question schema continues to reject an empty body field."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(CHAT_ROUTE, json={"question": ""})

    assert response.status_code == 422
