import pytest

from app.services.errors import (
    ProviderAuthError,
    ProviderInvalidResponseError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderBadGatewayError,
    LLMUpstreamBadGatewayError,
    LLMUnavailableError,
)
from app.api.controllers.llm_controller import get_provider
from app.main import app

try:
    from conftest import FakeProvider
except ImportError:
    from tests.conftest import FakeProvider


@pytest.mark.parametrize(
    "error, status, code",
    [
        (ProviderTimeoutError, 504, "LLM_UPSTREAM_TIMEOUT"),
        (ProviderRateLimitError, 503, "LLM_PROVIDER_RATE_LIMITED"),
        (ProviderAuthError, 502, "LLM_PROVIDER_AUTH_FAILED"),
        (ProviderUnavailableError, 502, "LLM_PROVIDER_UNAVAILABLE"),
        (ProviderInvalidResponseError, 502, "LLM_INVALID_RESPONSE"),
        (ProviderBadGatewayError, 502, "LLM_UPSTREAM_BAD_GATEWAY"),
        (LLMUpstreamBadGatewayError, 502, "LLM_UPSTREAM_BAD_GATEWAY"),
        (LLMUnavailableError, 502, "LLM_UNAVAILABLE"),
    ],
)
@pytest.mark.asyncio
async def test_provider_error_mapping(client, error, status, code):
    app.dependency_overrides[get_provider] = lambda: FakeProvider(error=error())
    response = await client.post(
        "/internal/llm/generate",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "max_output_tokens": 8,
            "temperature": 0,
            "output_format": "text",
        },
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert "test-access-token" not in response.text
