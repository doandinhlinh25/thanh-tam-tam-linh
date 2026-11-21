"""Required auth configuration, app-scoped client lifecycle and endpoint impact."""

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app


def valid_settings():
    return Settings(
        tenant_service_url="https://tenant.internal",
        chat_service_token="t" * 40,
        tenant_authorization_timeout_seconds=2.5,
        cors_origins=["http://localhost:3000"],
        llm_model="test-model",
        llm_api_key="provider-key",
        llm_api_access_token="internal-llm-token",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "changes",
    [
        {"TENANT_SERVICE_URL": ""},
        {"CHAT_SERVICE_TOKEN": "short"},
        {"TENANT_AUTHORIZATION_TIMEOUT_SECONDS": 0},
        {"CORS_ORIGINS": []},
        {"CORS_ORIGINS": ["*"]},
    ],
)
async def test_invalid_auth_configuration_aborts_lifespan_and_serving(changes):
    settings = valid_settings().model_dump()
    settings.update(changes)
    settings = Settings(**settings)
    app = create_app(settings)

    with pytest.raises(ValueError):
        async with app.router.lifespan_context(app):
            pytest.fail("invalid security config must not start the application")


@pytest.mark.asyncio
async def test_valid_lifespan_initializes_and_closes_app_scoped_tenant_client():
    app = create_app(valid_settings())
    async with app.router.lifespan_context(app):
        client = app.state.tenant_authorization_client
        assert client is not None
        assert client._base_url == "https://tenant.internal"
    assert app.state.tenant_authorization_client is None


@pytest.mark.asyncio
async def test_valid_startup_keeps_health_and_internal_llm_separately_protected():
    app = create_app(valid_settings())
    async with app.router.lifespan_context(app), httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        live = await client.get("/health/live")
        ready = await client.get("/health/ready")
        llm = await client.post(
            "/internal/llm/generate",
            json={
                "messages": [{"role": "user", "content": "hello"}],
                "max_output_tokens": 32,
                "temperature": 0.2,
                "output_format": "text",
                "prompt_version": "test-v1",
            },
        )
        preflight = await client.options(
            "/api/v1/courses/cccccccccccccccccccccccc/chat",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-tenant-id,x-csrf-token",
            },
        )

    assert live.status_code == 200
    assert ready.status_code == 200
    assert llm.status_code == 401
    assert llm.json()["error"]["code"] == "LLM_UNAUTHORIZED"
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert preflight.headers["access-control-allow-credentials"] == "true"
    allowed_headers = preflight.headers["access-control-allow-headers"].lower()
    assert "x-tenant-id" in allowed_headers
    assert "x-csrf-token" in allowed_headers

