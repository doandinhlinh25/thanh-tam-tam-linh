import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.main import app
from app.api.controllers.llm_controller import get_provider
from app.ai.llm.base import ProviderResult
from app.schemas.llm import Usage


class FakeProvider:
    def __init__(self, result=None, error=None):
        self.calls = 0
        self.result = result or ProviderResult("fake-model", "Xin chào", "stop", Usage(input_tokens=1, output_tokens=2, total_tokens=3))
        self.error = error

    async def generate(self, request):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


@pytest.fixture
def settings():
    return Settings(
        llm_base_url="http://provider.invalid/v1",
        llm_model="configured-model",
        llm_api_key="upstream-secret",
        llm_api_access_token="test-access-token",
    )


@pytest.fixture
def fake_provider():
    return FakeProvider()


@pytest_asyncio.fixture
async def client(settings, fake_provider):
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_provider] = lambda: fake_provider
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as value:
        yield value
    app.dependency_overrides.clear()
