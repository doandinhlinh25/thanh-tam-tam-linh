import pytest


@pytest.mark.asyncio
async def test_liveness_does_not_call_provider(client, fake_provider):
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}
    assert fake_provider.calls == 0


@pytest.mark.asyncio
async def test_readiness(client):
    response = await client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_readiness_missing_configuration(client, settings):
    settings.llm_model = ""
    response = await client.get("/health/ready")
    assert response.status_code == 503
    assert "upstream-secret" not in response.text


@pytest.mark.asyncio
async def test_health_root(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "chat-service"}

