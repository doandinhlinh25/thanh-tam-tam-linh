"""Unit tests for LLM provider adapters."""
import pytest
from unittest.mock import AsyncMock, patch
import httpx

from app.core.config import Settings
from app.ai.llm.providers.openai_provider import OpenAIProvider, OpenAICompatibleProvider
from app.ai.llm.schemas import LLMMessage, LLMRequest, LLMResponse
from app.schemas.llm import GenerateRequest, Message
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


@pytest.fixture
def provider_settings():
    return Settings(
        llm_base_url="https://api.openai.test/v1",
        llm_model="test-gpt-model",
        llm_api_key="test-api-key",
        llm_api_access_token="test-access-token",
        llm_timeout_seconds=5.0,
        llm_max_retries=0,
    )


@pytest.mark.asyncio
async def test_openai_provider_generate_success(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_response_data = {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "test-gpt-model",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Xin chào! Tôi có thể giúp gì?",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 9,
            "completion_tokens": 12,
            "total_tokens": 21,
        },
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_response_data,
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
            output_format="text",
        )
        result = await provider.generate(req)

        assert result.model == "test-gpt-model"
        assert result.text == "Xin chào! Tôi có thể giúp gì?"
        assert result.finish_reason == "stop"
        assert result.usage is not None
        assert result.usage.total_tokens == 21


@pytest.mark.asyncio
async def test_openai_provider_with_llm_request(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_response_data = {
        "model": "test-gpt-model",
        "choices": [
            {
                "message": {"role": "assistant", "content": "Nội dung trả lời"},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15},
    }
    mock_resp = httpx.Response(
        status_code=200,
        json=mock_response_data,
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = LLMRequest(
            messages=[LLMMessage(role="user", content="Test")],
            max_tokens=64,
            temperature=0.1,
        )
        response = await provider.generate(req)
        assert isinstance(response, LLMResponse)
        assert response.content == "Nội dung trả lời"
        assert response.prompt_tokens == 5
        assert response.completion_tokens == 10


@pytest.mark.asyncio
async def test_openai_provider_timeout(provider_settings):
    provider = OpenAIProvider(provider_settings)
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.TimeoutException("Timeout")
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
        )
        with pytest.raises(ProviderTimeoutError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_rate_limit(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=429,
        text="Rate limit exceeded",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
        )
        with pytest.raises(ProviderRateLimitError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_auth_error(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=401,
        text="Unauthorized",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
        )
        with pytest.raises(ProviderAuthError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_unavailable(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=500,
        text="Internal Server Error",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
        )
        with pytest.raises(ProviderUnavailableError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_invalid_response(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={"error": "corrupted response without choices"},
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
        )
        with pytest.raises(ProviderInvalidResponseError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_retry_on_failure(provider_settings):
    provider_settings.llm_max_retries = 1
    provider = OpenAIProvider(provider_settings)

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "Thành công"}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        # First attempt fails with Timeout, second succeeds
        mock_post.side_effect = [httpx.TimeoutException("Timeout"), mock_resp]
        req = GenerateRequest(
            messages=[Message(role="user", content="Xin chào")],
            max_output_tokens=50,
            temperature=0.7,
        )
        result = await provider.generate(req)
        assert result.text == "Thành công"
        assert mock_post.call_count == 2


@pytest.mark.asyncio
async def test_openai_provider_with_more_than_20_messages(provider_settings):
    """Confirm LLMRequest with > 20 messages is not blocked by GenerateRequest limit."""
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "Nội dung dài"}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = LLMRequest(
            messages=[LLMMessage(role="user", content=f"Tin nhắn {i}") for i in range(25)],
            max_tokens=64,
            temperature=0.5,
        )
        response = await provider.generate(req)
        assert response.content == "Nội dung dài"
        assert len(mock_post.call_args[1]["json"]["messages"]) == 25


@pytest.mark.asyncio
async def test_openai_provider_with_high_temperature(provider_settings):
    """Confirm LLMRequest with temperature > 1.0 is accepted."""
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "Sáng tạo"}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = LLMRequest(
            messages=[LLMMessage(role="user", content="Viết thơ")],
            max_tokens=64,
            temperature=1.6,
        )
        response = await provider.generate(req)
        assert response.content == "Sáng tạo"
        assert mock_post.call_args[1]["json"]["temperature"] == 1.6


@pytest.mark.asyncio
async def test_openai_provider_fallback_to_openai_model_and_key():
    """Confirm fallback to OPENAI_MODEL and OPENAI_API_KEY when LLM_MODEL/LLM_API_KEY are empty."""
    settings = Settings(
        llm_model="",
        llm_api_key="",
        OPENAI_MODEL="gpt-4o-mini",
        OPENAI_API_KEY="sk-fallback-key",
    )
    provider = OpenAIProvider(settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "gpt-4o-mini",
            "choices": [{"message": {"role": "assistant", "content": "Fallback OK"}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        res = await provider.generate(req)
        assert res.model == "gpt-4o-mini"
        assert mock_post.call_args[1]["headers"]["Authorization"] == "Bearer sk-fallback-key"


def test_error_definitions_and_aliases():
    from app.services.errors import (
        ProviderBadGatewayError,
        LLMUpstreamBadGatewayError,
        LLMUnavailableError,
        ProviderUnavailableError,
    )
    assert issubclass(ProviderBadGatewayError, ProviderUnavailableError)
    assert issubclass(LLMUpstreamBadGatewayError, ProviderBadGatewayError)
    assert issubclass(LLMUnavailableError, ProviderUnavailableError)
    assert LLMUpstreamBadGatewayError.code == "LLM_UPSTREAM_BAD_GATEWAY"
    assert LLMUnavailableError.code == "LLM_UNAVAILABLE"


def test_openai_compatible_provider_alias():
    assert OpenAICompatibleProvider is OpenAIProvider


def test_schema_contract_aliases():
    from app.schemas.llm import ErrorBody, ErrorResponse, Output, GenerateOutput
    assert ErrorResponse is ErrorBody
    assert GenerateOutput is Output


def test_llm_factory():
    from app.ai.llm.factory import LLMFactory
    s1 = Settings(LLM_PROVIDER="openai")
    p1 = LLMFactory.get_provider(s1)
    assert isinstance(p1, OpenAIProvider)

    s2 = Settings(LLM_PROVIDER="openai_compatible")
    p2 = LLMFactory.get_provider(s2)
    assert isinstance(p2, OpenAIProvider)

    s3 = Settings(LLM_PROVIDER="openai-compatible")
    p3 = LLMFactory.get_provider(s3)
    assert isinstance(p3, OpenAIProvider)

    s4 = Settings(LLM_PROVIDER="unknown_provider")
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        LLMFactory.get_provider(s4)


@pytest.mark.asyncio
async def test_openai_provider_with_injected_client(provider_settings):
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "Injected client OK"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 3, "completion_tokens": 4, "total_tokens": 7},
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=mock_resp)

    provider = OpenAIProvider(provider_settings, client=mock_client)
    req = LLMRequest(messages=[LLMMessage(role="user", content="Test")])
    res = await provider.generate(req)
    assert res.content == "Injected client OK"
    assert res.total_tokens == 7
    mock_client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_openai_provider_empty_choices_raises_invalid_response(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={"model": "test-gpt-model", "choices": [], "usage": None},
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        with pytest.raises(ProviderInvalidResponseError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_null_content_raises_invalid_response(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": None}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        with pytest.raises(ProviderInvalidResponseError):
            await provider.generate(req)


@pytest.mark.asyncio
async def test_openai_provider_url_with_existing_chat_completions(provider_settings):
    provider_settings.llm_base_url = "https://api.openai.test/v1/chat/completions"
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "URL OK"}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        await provider.generate(req)
        called_url = mock_post.call_args[0][0]
        assert called_url == "https://api.openai.test/v1/chat/completions"
        assert not called_url.endswith("/chat/completions/chat/completions")


@pytest.mark.asyncio
async def test_openai_provider_bad_gateway_status_502(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=502,
        text="Bad Gateway",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        with pytest.raises(LLMUpstreamBadGatewayError) as exc_info:
            await provider.generate(req)
        assert exc_info.value.code == "LLM_UPSTREAM_BAD_GATEWAY"
        assert exc_info.value.status_code == 502
        assert isinstance(exc_info.value, ProviderBadGatewayError)
        assert isinstance(exc_info.value, ProviderUnavailableError)


@pytest.mark.asyncio
async def test_openai_provider_unavailable_status_503(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=503,
        text="Service Unavailable",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        with pytest.raises(LLMUnavailableError) as exc_info:
            await provider.generate(req)
        assert exc_info.value.code == "LLM_UNAVAILABLE"
        assert exc_info.value.status_code == 502
        assert isinstance(exc_info.value, ProviderUnavailableError)


@pytest.mark.asyncio
async def test_openai_provider_gateway_timeout_status_504(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=504,
        text="Gateway Timeout",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        with pytest.raises(ProviderTimeoutError) as exc_info:
            await provider.generate(req)
        assert exc_info.value.code == "LLM_UPSTREAM_TIMEOUT"
        assert exc_info.value.status_code == 504


@pytest.mark.asyncio
async def test_openai_provider_request_timeout_status_408(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=408,
        text="Request Timeout",
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        with pytest.raises(ProviderTimeoutError) as exc_info:
            await provider.generate(req)
        assert exc_info.value.code == "LLM_UPSTREAM_TIMEOUT"
        assert exc_info.value.status_code == 504


@pytest.mark.asyncio
async def test_openai_provider_usage_total_tokens_fallback(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "OK"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20},  # missing total_tokens
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = GenerateRequest(
            messages=[Message(role="user", content="Test")],
            max_output_tokens=10,
            temperature=0.0,
        )
        result = await provider.generate(req)
        assert result.usage is not None
        assert result.usage.input_tokens == 10
        assert result.usage.prompt_tokens == 10
        assert result.usage.output_tokens == 20
        assert result.usage.completion_tokens == 20
        assert result.usage.total_tokens == 30


@pytest.mark.asyncio
async def test_openai_provider_llm_request_json_object(provider_settings):
    provider = OpenAIProvider(provider_settings)
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "model": "test-gpt-model",
            "choices": [{"message": {"role": "assistant", "content": "{\"key\": \"val\"}"}, "finish_reason": "stop"}],
            "usage": None,
        },
        request=httpx.Request("POST", "https://api.openai.test/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = LLMRequest(
            messages=[LLMMessage(role="user", content="Test JSON")],
            output_format="json_object",
        )
        resp = await provider.generate(req)
        assert resp.content == "{\"key\": \"val\"}"
        assert resp.finish_reason == "stop"
        called_payload = mock_post.call_args[1]["json"]
        assert called_payload.get("response_format") == {"type": "json_object"}


@pytest.mark.asyncio
async def test_openai_provider_aclose(provider_settings):
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.is_closed = False
    mock_client.aclose = AsyncMock()

    provider = OpenAIProvider(provider_settings, client=mock_client)
    await provider.aclose()
    mock_client.aclose.assert_awaited_once()



