"""Tenant HTTP wire behavior and fail-closed response validation."""

import httpx
import pytest

from app.integrations.tenant_authorization.client import TenantAuthorizationClient
from app.integrations.tenant_authorization.errors import ChatAuthorizationError

USER = "aaaaaaaaaaaaaaaaaaaaaaaa"
TENANT = "bbbbbbbbbbbbbbbbbbbbbbbb"


def context_success(**changes):
    data = {
        "allowed": True,
        "userId": USER,
        "tenantId": TENANT,
        "role": "student",
        "csrfVerified": True,
    }
    data.update(changes)
    return {"code": "success", "successful": True, "data": data}


def check_success(**changes):
    data = {"allowed": True, "userId": USER, "tenantId": TENANT}
    data.update(changes)
    return {"code": "success", "successful": True, "data": data}


@pytest.mark.asyncio
async def test_context_posts_contract_payload_and_only_forwarded_headers():
    seen = []

    async def handler(request):
        seen.append(request)
        return httpx.Response(200, json=context_success())

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = TenantAuthorizationClient("https://tenant.invalid", "service-secret", http)
    await client.resolve_context(
        tenant_id=TENANT,
        session_cookie="tokenAdmin=user-session",
        csrf_token="csrf-value",
    )
    request = seen[0]
    assert request.method == "POST"
    assert str(request.url) == "https://tenant.invalid/internal/authorization/context"
    assert request.read().decode() == '{"tenantId":"bbbbbbbbbbbbbbbbbbbbbbbb"}'
    assert request.headers["Authorization"] == "Bearer service-secret"
    assert request.headers["Cookie"] == "tokenAdmin=user-session"
    assert request.headers["X-CSRF-Token"] == "csrf-value"
    assert "X-User-Id" not in request.headers
    assert "X-Tenant-Id" not in request.headers
    assert "X-Role" not in request.headers
    await http.aclose()


@pytest.mark.asyncio
async def test_check_posts_required_course_and_chat_action_without_csrf():
    seen = []

    async def handler(request):
        seen.append(request)
        return httpx.Response(200, json=check_success())

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = TenantAuthorizationClient("https://tenant.invalid", "token", http)
    result = await client.check_course(
        tenant_id=TENANT,
        course_id="cccccccccccccccccccccccc",
        action="chat:ask",
        session_cookie="tokenAdmin=session",
    )
    assert result.data.allowed is True
    request = seen[0]
    assert str(request.url) == "https://tenant.invalid/internal/authorization/check"
    assert request.read().decode() == (
        '{"tenantId":"bbbbbbbbbbbbbbbbbbbbbbbb",'
        '"courseId":"cccccccccccccccccccccccc","action":"chat:ask"}'
    )
    assert request.headers["Cookie"] == "tokenAdmin=session"
    assert "X-CSRF-Token" not in request.headers
    await http.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,reason,expected_status,expected_code",
    [
        (401, "SESSION_INVALID", 401, "SESSION_INVALID"),
        (401, "SERVICE_CREDENTIAL_INVALID", 503, "AUTH_DEPENDENCY_FAILURE"),
        (403, "TENANT_ACCESS_DENIED", 403, "TENANT_ACCESS_DENIED"),
        (403, "COURSE_ACCESS_DENIED", 403, "COURSE_ACCESS_DENIED"),
        (403, "CSRF_INVALID", 403, "CSRF_INVALID"),
        (503, "AUTH_SERVICE_CREDENTIAL_INVALID", 503, "AUTH_DEPENDENCY_FAILURE"),
        (503, "AUTH_SERVICE_UNAVAILABLE", 503, "AUTH_DEPENDENCY_FAILURE"),
        (503, "AUTH_RESPONSE_INVALID", 502, "AUTH_DEPENDENCY_INVALID_RESPONSE"),
    ],
)
async def test_known_upstream_reason_codes_map_without_leaking(status, reason, expected_status, expected_code):
    async def handler(_request):
        return httpx.Response(
            status,
            json={"code": "error", "message": "upstream secret", "reasonCode": reason},
        )

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = TenantAuthorizationClient("https://tenant.invalid", "token", http)
    with pytest.raises(ChatAuthorizationError) as caught:
        await client.resolve_context(tenant_id=TENANT, session_cookie="tokenAdmin=s", csrf_token=None)
    assert caught.value.status_code == expected_status
    assert caught.value.error_code == expected_code
    assert "upstream secret" not in caught.value.message
    await http.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"code": "error", "message": "bad", "reasonCode": "UNKNOWN_REASON"},
        {"code": "success", "successful": True, "data": {"allowed": True}},
        {"code": "success", "successful": True, "data": {"allowed": False}},
        {"code": "success", "successful": "true", "data": {}},
    ],
)
async def test_unknown_reason_and_malformed_success_fail_closed(body):
    async def handler(_request):
        status = 503 if body.get("code") == "error" else 200
        return httpx.Response(status, json=body)

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = TenantAuthorizationClient("https://tenant.invalid", "token", http)
    with pytest.raises(ChatAuthorizationError) as caught:
        await client.resolve_context(tenant_id=TENANT, session_cookie="tokenAdmin=s", csrf_token=None)
    assert caught.value.status_code == 502
    assert caught.value.error_code == "AUTH_DEPENDENCY_INVALID_RESPONSE"
    await http.aclose()


@pytest.mark.asyncio
async def test_non_json_upstream_failure_and_network_error_are_sanitized():
    async def bad_status(_request):
        return httpx.Response(500, text="service-secret")

    http = httpx.AsyncClient(transport=httpx.MockTransport(bad_status))
    client = TenantAuthorizationClient("https://tenant.invalid", "token", http)
    with pytest.raises(ChatAuthorizationError) as caught:
        await client.resolve_context(tenant_id=TENANT, session_cookie="tokenAdmin=s", csrf_token=None)
    assert caught.value.status_code == 502
    assert "service-secret" not in caught.value.message
    await http.aclose()

    async def network_error(_request):
        raise httpx.ConnectError("service-secret")

    http = httpx.AsyncClient(transport=httpx.MockTransport(network_error))
    client = TenantAuthorizationClient("https://tenant.invalid", "token", http)
    with pytest.raises(ChatAuthorizationError) as caught:
        await client.resolve_context(tenant_id=TENANT, session_cookie="tokenAdmin=s", csrf_token=None)
    assert caught.value.status_code == 503
    assert "service-secret" not in caught.value.message
    await http.aclose()


@pytest.mark.asyncio
async def test_timeout_maps_to_gateway_timeout():
    async def timeout(_request):
        raise httpx.ReadTimeout("secret")

    http = httpx.AsyncClient(transport=httpx.MockTransport(timeout))
    client = TenantAuthorizationClient("https://tenant.invalid", "token", http)
    with pytest.raises(ChatAuthorizationError) as caught:
        await client.resolve_context(tenant_id=TENANT, session_cookie="tokenAdmin=s", csrf_token=None)
    assert caught.value.status_code == 504
    await http.aclose()

