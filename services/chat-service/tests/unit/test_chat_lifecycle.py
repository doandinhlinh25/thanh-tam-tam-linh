"""ChatService dependency cleanup and pipeline ownership tests."""
from unittest.mock import AsyncMock

import pytest

from app.services.chat_service import ChatService


@pytest.mark.asyncio
async def test_chat_service_closes_owned_pipeline_once(monkeypatch):
    import app.services.chat_service as chat_service_module

    pipeline = AsyncMock()
    monkeypatch.setattr(chat_service_module, "AIPipeline", lambda: pipeline)
    service = ChatService()

    await service.close()
    await service.close()

    pipeline.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_service_does_not_close_injected_shared_pipeline():
    pipeline = AsyncMock()
    service = ChatService(pipeline=pipeline, owns_pipeline=False)

    await service.close()
    await service.close()

    pipeline.close.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("request_fails", [False, True])
async def test_chat_service_dependency_closes_after_success_or_failure(monkeypatch, request_fails):
    import app.api.controllers.chat_controller as controller

    service = AsyncMock()
    monkeypatch.setattr(controller, "ChatService", lambda **_kwargs: service)
    uow = AsyncMock()
    dependency = controller.get_chat_service(uow)
    assert await anext(dependency) is service

    if request_fails:
        with pytest.raises(RuntimeError, match="endpoint failed"):
            await dependency.athrow(RuntimeError("endpoint failed"))
    else:
        with pytest.raises(StopAsyncIteration):
            await anext(dependency)

    service.close.assert_awaited_once()
