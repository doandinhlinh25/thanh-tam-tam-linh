"""ASGI checks for Chat authorization ordering and fail-closed behavior."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from app.api.controllers.chat_controller import get_chat_service
from app.core.config import Settings, get_settings
from app.dependencies import get_tenant_authorization_client
from app.integrations.tenant_authorization.errors import ChatAuthorizationError
from app.main import app

TENANT = "bbbbbbbbbbbbbbbbbbbbbbbb"
USER = "aaaaaaaaaaaaaaaaaaaaaaaa"
COURSE = "cccccccccccccccccccccccc"
ORIGIN = "http://localhost:3000"
ROUTE = f"/api/v1/courses/{COURSE}/chat"
BODY = {"question": "Question"}


def fake_settings():
    return Settings(
        tenant_service_url="https://tenant.internal",
        chat_service_token="t" * 40,
        cors_origins=[ORIGIN],
    )


def context(*, tenant_id=TENANT, user_id=USER, csrf_verified=True):
    return SimpleNamespace(
        data=SimpleNamespace(
            allowed=True,
            tenant_id=tenant_id,
            user_id=user_id,
            role="student",
            csrf_verified=csrf_verified,
        )
    )


def check(*, tenant_id=TENANT, user_id=USER):
    return SimpleNamespace(
        data=SimpleNamespace(allowed=True, tenant_id=tenant_id, user_id=user_id)
    )


def request_headers(cookie="tokenAdmin=session", origin=ORIGIN, csrf="csrf-token"):
    values = [
        ("x-tenant-id", TENANT),
        ("cookie", cookie),
    ]
    if origin is not None:
        values.append(("origin", origin))
    if csrf is not None:
        values.append(("x-csrf-token", csrf))
    return values


@pytest.fixture(autouse=True)
def dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


async def send(headers=None, path=ROUTE):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.post(path, json=BODY, headers=headers or request_headers())


def install(tenant_client, chat_service):
    app.dependency_overrides[get_settings] = fake_settings
    app.dependency_overrides[get_tenant_authorization_client] = lambda: tenant_client
    app.dependency_overrides[get_chat_service] = lambda: chat_service


def tenant_client(context_result=None, check_result=None):
    return SimpleNamespace(
        resolve_context=AsyncMock(return_value=context_result or context()),
        check_course=AsyncMock(return_value=check_result or check()),
    )


def chat_service():
    return SimpleNamespace(
        answer_question=AsyncMock(
            return_value={"conversation_id": "conv", "message_id": "msg", "answer": "answer"}
        )
    )


@pytest.mark.asyncio
async def test_success_checks_context_then_course_then_calls_chat_once(caplog):
    events = []
    auth = tenant_client()
    auth.resolve_context.side_effect = lambda **kwargs: events.append("context") or context()
    auth.check_course.side_effect = lambda **kwargs: events.append("check") or check()
    service = chat_service()
    service.answer_question.side_effect = lambda *_: events.append("chat") or {
        "conversation_id": "conv", "message_id": "msg", "answer": "answer"
    }
    install(auth, service)

    response = await send()

    assert response.status_code == 200
    assert events == ["context", "check", "chat"]
    assert auth.resolve_context.await_args.kwargs == {
        "tenant_id": TENANT,
        "session_cookie": "tokenAdmin=session",
        "csrf_token": "csrf-token",
    }
    assert auth.check_course.await_args.kwargs == {
        "tenant_id": TENANT,
        "course_id": COURSE,
        "action": "chat:ask",
        "session_cookie": "tokenAdmin=session",
    }
    trusted = service.answer_question.await_args.args[0]
    assert (trusted.user_id, trusted.tenant_id, trusted.course_id) == (USER, TENANT, COURSE)
    service.answer_question.assert_awaited_once()
    for secret in ("session", "csrf-token", "forged-user-token", "t" * 40):
        assert secret not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "raw_headers,expected_status,expected_code",
    [
        ([ ("x-tenant-id", TENANT), ("origin", ORIGIN) ], 401, "SESSION_INVALID"),
        ([("x-tenant-id", "not-an-id"), *request_headers()[1:]], 400, "VALIDATION_ERROR"),
        ([("x-tenant-id", TENANT), ("cookie", "tokenAdmin=a; tokenAdmin=b"), ("origin", ORIGIN)], 400, "VALIDATION_ERROR"),
        ([("x-tenant-id", TENANT), ("cookie", "tokenAdmin=a"), ("cookie", "tokenAdmin=b"), ("origin", ORIGIN)], 400, "VALIDATION_ERROR"),
        ([("x-tenant-id", TENANT), ("x-tenant-id", TENANT), ("cookie", "tokenAdmin=a"), ("origin", ORIGIN)], 400, "VALIDATION_ERROR"),
        (request_headers(origin="https://attacker.invalid"), 403, "ORIGIN_INVALID"),
        (request_headers(origin=None), 403, "ORIGIN_INVALID"),
    ],
)
async def test_invalid_selector_session_cookie_or_origin_fails_before_tenant(
    raw_headers, expected_status, expected_code
):
    auth, service = tenant_client(), chat_service()
    install(auth, service)

    response = await send(raw_headers)

    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == expected_code
    auth.resolve_context.assert_not_awaited()
    service.answer_question.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "context_value,check_value,expected_status,expected_code,expected_tenant_calls",
    [
        (context(csrf_verified=False), None, 403, "CSRF_INVALID", 1),
        (context(tenant_id="dddddddddddddddddddddddd"), None, 502, "AUTH_DEPENDENCY_INVALID_RESPONSE", 1),
        (None, None, 401, "SESSION_INVALID", 1),
        (None, None, 503, "AUTH_DEPENDENCY_FAILURE", 1),
        (context(), SimpleNamespace(data=SimpleNamespace(allowed=True, user_id="dddddddddddddddddddddddd", tenant_id=TENANT)), 502, "AUTH_DEPENDENCY_INVALID_RESPONSE", 2),
        (context(), None, 403, "COURSE_ACCESS_DENIED", 2),
    ],
)
async def test_upstream_denials_and_identity_mismatch_never_call_chat(
    context_value, check_value, expected_status, expected_code, expected_tenant_calls
):
    auth = tenant_client(context_value or context(), check_value or check())
    if expected_status == 401:
        auth.resolve_context.side_effect = ChatAuthorizationError(401, "SESSION_INVALID", "Vui lòng đăng nhập lại.")
    elif expected_status == 503:
        auth.resolve_context.side_effect = ChatAuthorizationError(503, "AUTH_DEPENDENCY_FAILURE", "Dịch vụ xác thực hiện không sẵn sàng.")
    elif expected_status == 403 and expected_code == "COURSE_ACCESS_DENIED":
        auth.check_course.side_effect = ChatAuthorizationError(403, "COURSE_ACCESS_DENIED", "Không có quyền truy cập khóa học.")
    service = chat_service()
    install(auth, service)

    response = await send()

    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == expected_code
    assert auth.resolve_context.await_count == 1
    assert auth.check_course.await_count == (expected_tenant_calls - 1)
    service.answer_question.assert_not_awaited()


@pytest.mark.asyncio
async def test_forged_browser_identity_headers_are_not_forwarded_or_trusted():
    auth, service = tenant_client(), chat_service()
    install(auth, service)
    headers = request_headers() + [
        ("x-user-id", "dddddddddddddddddddddddd"),
        ("x-role", "tenant_owner"),
        ("authorization", "Bearer forged-user-token"),
    ]

    response = await send(headers)

    assert response.status_code == 200
    assert auth.resolve_context.await_args.kwargs["session_cookie"] == "tokenAdmin=session"
    assert "forged-user-token" not in response.text
    service.answer_question.assert_awaited_once()


@pytest.mark.asyncio
async def test_csrf_header_is_optional_for_context_but_false_result_blocks_mutation():
    auth = tenant_client(context(csrf_verified=False))
    service = chat_service()
    install(auth, service)

    response = await send(request_headers(csrf=None))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_INVALID"
    assert auth.resolve_context.await_args.kwargs["csrf_token"] is None
    auth.check_course.assert_not_awaited()
    service.answer_question.assert_not_awaited()


@pytest.mark.asyncio
async def test_duplicate_csrf_headers_are_rejected_before_tenant():
    auth, service = tenant_client(), chat_service()
    install(auth, service)
    headers = request_headers() + [("x-csrf-token", "second-token")]

    response = await send(headers)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_INVALID"
    auth.resolve_context.assert_not_awaited()
    service.answer_question.assert_not_awaited()


@pytest.mark.asyncio
async def test_invalid_course_id_is_rejected_without_fabricating_or_calling_tenant():
    auth, service = tenant_client(), chat_service()
    install(auth, service)

    response = await send(path="/api/v1/courses/not-a-course/chat")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    auth.resolve_context.assert_not_awaited()
    service.answer_question.assert_not_awaited()

