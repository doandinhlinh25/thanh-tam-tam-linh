import uuid
import pytest


def payload(**changes):
    value = {
        "messages": [{"role": "user", "content": "Xin chào"}],
        "max_output_tokens": 32,
        "temperature": 0.2,
        "output_format": "text",
        "prompt_version": "test-v1",
    }
    value.update(changes)
    return value


@pytest.mark.asyncio
async def test_happy_path(client):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 200
    assert response.json()["model"] == "fake-model"
    assert response.json()["usage"]["total_tokens"] == 3


@pytest.mark.asyncio
async def test_missing_token_does_not_call_provider(client, fake_provider):
    response = await client.post("/internal/llm/generate", json=payload())
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "LLM_UNAUTHORIZED"
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_invalid_token_rejected(client, fake_provider):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "LLM_UNAUTHORIZED"
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_invalid_request_is_422_and_does_not_call_provider(client, fake_provider):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(messages=[]),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 422
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_json_object_mode(client, fake_provider):
    fake_provider.result = type(fake_provider.result)(
        "fake-model", '{"answer":"được"}', "stop", None
    )
    response = await client.post(
        "/internal/llm/generate",
        json=payload(output_format="json_object"),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 200
    assert response.json()["output"]["text"] == '{"answer":"được"}'
    assert response.json()["usage"] is None


@pytest.mark.asyncio
async def test_invalid_json_object_response(client, fake_provider):
    fake_provider.result = type(fake_provider.result)("fake-model", "not-json", "stop", None)
    response = await client.post(
        "/internal/llm/generate",
        json=payload(output_format="json_object"),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "LLM_INVALID_RESPONSE"


@pytest.mark.asyncio
async def test_input_limit(client, fake_provider, settings):
    settings.llm_max_input_chars = 3
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 422
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_x_request_id_valid_uuid_propagated(client):
    test_id = str(uuid.uuid4())
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={
            "Authorization": "Bearer test-access-token",
            "X-Request-ID": test_id,
        },
    )
    assert response.status_code == 200
    assert response.json()["request_id"] == test_id


@pytest.mark.asyncio
async def test_x_request_id_invalid_uuid_generates_new(client):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={
            "Authorization": "Bearer test-access-token",
            "X-Request-ID": "invalid-uuid-string",
        },
    )
    assert response.status_code == 200
    res_id = response.json()["request_id"]
    assert res_id != "invalid-uuid-string"
    uuid.UUID(res_id)  # Does not raise
    # Header and body must match
    assert response.headers.get("x-request-id") == res_id


@pytest.mark.asyncio
async def test_x_request_id_header_matches_body_without_incoming_header(client):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 200
    res_id = response.json()["request_id"]
    assert response.headers.get("x-request-id") == res_id


@pytest.mark.asyncio
async def test_x_request_id_header_matches_body_on_unauthorized(client):
    response = await client.post("/internal/llm/generate", json=payload())
    assert response.status_code == 401
    res_id = response.json()["request_id"]
    assert response.headers.get("x-request-id") == res_id


@pytest.mark.asyncio
async def test_x_request_id_header_matches_body_on_validation_error(client):
    response = await client.post(
        "/internal/llm/generate",
        json={"messages": []},
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 422
    res_id = response.json()["request_id"]
    assert response.headers.get("x-request-id") == res_id


@pytest.mark.asyncio
async def test_route_table_cleanliness(client):
    from app.main import app
    paths = set(app.openapi()["paths"].keys())
    # Internal generation and health live/ready must be at root
    assert "/internal/llm/generate" in paths
    assert "/health/live" in paths
    assert "/health/ready" in paths
    # Public chat service routes must be under /api/v1
    assert "/api/v1/courses/{course_id}/chat" in paths
    assert "/api/v1/conversations" in paths
    # Unprefixed business routes must NOT exist
    assert "/courses/{course_id}/chat" not in paths
    assert "/conversations" not in paths
    # Duplicate health routes under /api/v1 must NOT exist
    assert "/api/v1/health" not in paths
    assert "/api/v1/health/live" not in paths
    assert "/api/v1/health/ready" not in paths


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_payload",
    [
        {"messages": [{"role": "user", "content": "   "}]},
        {"messages": [{"role": "user", "content": ""}]},
        {"messages": [{"role": "invalid_role", "content": "hello"}]},
        {"temperature": -0.1},
        {"temperature": 1.5},
        {"max_output_tokens": 0},
        {"max_output_tokens": -10},
        {"messages": [{"role": "user", "content": "hi"}], "extra_unknown_field": "forbidden"},
        {"messages": [{"role": "user", "content": f"msg {i}"} for i in range(21)]},
        {"output_format": "xml"},
        {"prompt_version": "x" * 101},
    ],
)
async def test_generate_input_validation_edge_cases(client, fake_provider, invalid_payload):
    req_body = payload()
    req_body.update(invalid_payload)
    response = await client.post(
        "/internal/llm/generate",
        json=req_body,
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "LLM_INVALID_REQUEST"
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_max_output_tokens_exceeds_configured_limit(client, fake_provider, settings):
    settings.llm_max_output_tokens = 50
    response = await client.post(
        "/internal/llm/generate",
        json=payload(max_output_tokens=100),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "LLM_INVALID_REQUEST"
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_malformed_json_request_body(client, fake_provider):
    response = await client.post(
        "/internal/llm/generate",
        content=b"{invalid json syntax",
        headers={
            "Authorization": "Bearer test-access-token",
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "LLM_INVALID_REQUEST"
    assert fake_provider.calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "non_dict_json",
    [
        "[1, 2, 3]",
        '"just a string"',
        "12345",
        "true",
    ],
)
async def test_non_dict_json_object_response_raises_502(client, fake_provider, non_dict_json):
    fake_provider.result = type(fake_provider.result)("fake-model", non_dict_json, "stop", None)
    response = await client.post(
        "/internal/llm/generate",
        json=payload(output_format="json_object"),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "LLM_INVALID_RESPONSE"


@pytest.mark.asyncio
async def test_case_insensitive_bearer_scheme(client):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "bearer test-access-token"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_wrong_auth_scheme_rejected(client, fake_provider):
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "Basic test-access-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "LLM_UNAUTHORIZED"
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_empty_server_access_token_rejects_requests(client, fake_provider, settings):
    settings.llm_api_access_token = ""
    response = await client.post(
        "/internal/llm/generate",
        json=payload(),
        headers={"Authorization": "Bearer test-access-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "LLM_UNAUTHORIZED"
    assert fake_provider.calls == 0


