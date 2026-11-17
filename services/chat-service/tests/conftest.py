import os
import uuid
from datetime import UTC

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.ai.llm.base import ProviderResult
from app.api.controllers.llm_controller import get_provider
from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.llm import Usage


@pytest.fixture
def mongo_test_uri():
    uri = os.getenv("MONGODB_TEST_URI")
    if not uri:
        pytest.skip("MONGODB_TEST_URI is not configured; replica-set integration tests not run")
    return uri


@pytest_asyncio.fixture
async def mongo_uow(mongo_test_uri):
    """Isolated database on the real replica-set integration deployment."""

    from bson.codec_options import CodecOptions
    from pymongo import AsyncMongoClient

    from app.dependencies import get_uow
    from app.integrations.database.unit_of_work import UnitOfWork
    from scripts.mongodb_migrate import ensure_indexes

    client = AsyncMongoClient(mongo_test_uri, serverSelectionTimeoutMS=2000)
    try:
        hello = await client.admin.command("hello")
        if hello.get("setName") != "rs0" or not hello.get("isWritablePrimary"):
            pytest.fail("MongoDB integration target is not a writable rs0 replica-set primary")
        database = client.get_database(
            f"tt_chat_test_{uuid.uuid4().hex}",
            codec_options=CodecOptions(tz_aware=True, tzinfo=UTC),
        )
        await ensure_indexes(database)
        uow = UnitOfWork(client, database)
        yield uow
    finally:
        if "uow" in locals():
            await uow.close()
        from app.main import app
        app.dependency_overrides.pop(get_uow, None)
        if "database" in locals():
            await client.drop_database(database.name)
        await client.close()


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
