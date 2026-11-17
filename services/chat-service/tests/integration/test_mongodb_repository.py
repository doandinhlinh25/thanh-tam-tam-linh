"""Repository and transaction integration tests against a real rs0 deployment."""
import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pymongo.errors import ServerSelectionTimeoutError

from app.domain.entities.conversation import Conversation
from app.domain.entities.feedback import Feedback
from app.domain.entities.message import Message
from app.domain.value_objects.citation import ChatCitation


def conversation(owner="u1", tenant="t1", identifier=None):
    now = datetime.now(UTC)
    return Conversation(identifier or f"conv-{uuid4().hex}", tenant, owner, "course-1", "title",
                        now, now, source_scope="course_only")


@pytest.mark.asyncio
async def test_replica_set_handshake(mongo_uow):
    hello = await mongo_uow.client.admin.command("hello")
    assert hello["setName"] == "rs0"
    assert hello["isWritablePrimary"] is True
    assert "localhost:27018" in hello["hosts"]


@pytest.mark.asyncio
async def test_conversation_crud_and_owner_isolation(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.commit()
    assert (await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1")).id == conv.id
    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "other") is None
    assert await mongo_uow.conversations.get_by_id(conv.id, "other", "u1") is None


@pytest.mark.asyncio
async def test_message_order_citations_and_cursor_pagination(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    created = datetime(2026, 1, 1, tzinfo=UTC)
    citation = ChatCitation("cit-1", "ev-1", "official", "doc-1", "Doc", 3, 4, "snippet")
    for mid in ("msg-a", "msg-b", "msg-c"):
        await mongo_uow.messages.save(Message(mid, conv.id, "assistant", mid, created, citations=[citation]))
    await mongo_uow.commit()
    first = await mongo_uow.messages.list_by_conversation(conv.id, "t1", "u1", limit=2)
    assert [m.id for m in first] == ["msg-a", "msg-b"]
    assert first[0].citations[0] == citation
    from app.core.pagination import encode_cursor
    cursor = encode_cursor(first[-1].created_at, first[-1].id)
    rest = await mongo_uow.messages.list_by_conversation(conv.id, "t1", "u1", cursor=cursor)
    assert [m.id for m in rest] == ["msg-c"]


@pytest.mark.asyncio
async def test_fast_chat_persists_user_before_assistant_with_bson_cursor_pagination(mongo_uow, monkeypatch):
    from app.ai.pipeline import PipelineResult
    from app.domain.value_objects.tenant_context import TenantContext
    from app.services import chat_service as chat_service_module
    from app.services.chat_service import ChatService

    fixed = datetime(2026, 1, 1, 12, 0, 0, 123456, tzinfo=UTC)

    class FixedDateTime:
        @staticmethod
        def now(tz=None):
            return fixed

    class FastPipeline:
        async def run(self, **_kwargs):
            return PipelineResult(result_state="answered", answer="instant", citations=[], metadata={})

    monkeypatch.setattr(chat_service_module, "datetime", FixedDateTime)
    service = ChatService(uow=mongo_uow, pipeline=FastPipeline())
    context = TenantContext(tenant_id="t1", user_id="u1", course_id="course-1")

    result = await service.answer_question(context, "question")
    first_page = await mongo_uow.messages.list_by_conversation(
        result.conversation_id, "t1", "u1", limit=1
    )
    from app.core.pagination import encode_cursor

    second_page = await mongo_uow.messages.list_by_conversation(
        result.conversation_id,
        "t1",
        "u1",
        limit=1,
        cursor=encode_cursor(first_page[0].created_at, first_page[0].id),
    )

    assert [message.role for message in first_page + second_page] == ["user", "assistant"]
    assert first_page[0].created_at.microsecond % 1000 == 0
    assert second_page[0].created_at.microsecond % 1000 == 0
    assert first_page[0].created_at < second_page[0].created_at


@pytest.mark.asyncio
@pytest.mark.parametrize("iteration", range(3))
async def test_feedback_wins_race_then_hard_delete_retries_and_cascades(mongo_uow, monkeypatch, iteration):
    from app.integrations.database.unit_of_work import UnitOfWork
    from app.services.conversation_service import ConversationService

    conv = conversation(identifier=f"conv-feedback-first-{iteration}")
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message(
        f"msg-feedback-first-{iteration}", conv.id, "assistant", "answer", datetime.now(UTC),
        citations=[ChatCitation("cit-race", "ev-race", "official", "doc-race", "Doc", 1, 1, "snapshot")],
    ))
    await mongo_uow.commit()

    feedback_uow = UnitOfWork(mongo_uow.client, mongo_uow.database)
    delete_uow = UnitOfWork(mongo_uow.client, mongo_uow.database)
    feedback_fenced = asyncio.Event()
    finish_feedback = asyncio.Event()
    delete_waiting = asyncio.Event()
    finish_delete = asyncio.Event()
    original_fence = feedback_uow.conversations.fence_feedback_write
    original_delete = delete_uow.conversations.delete
    original_begin = delete_uow.begin
    begin_count = 0

    async def pause_after_fence(conversation_id, tenant_id, user_id):
        result = await original_fence(conversation_id, tenant_id, user_id)
        feedback_fenced.set()
        await finish_feedback.wait()
        return result

    async def pause_before_parent_delete(*args, **kwargs):
        delete_waiting.set()
        await finish_delete.wait()
        return await original_delete(*args, **kwargs)

    async def count_begin():
        nonlocal begin_count
        if not delete_uow._transaction_active:
            begin_count += 1
        await original_begin()

    monkeypatch.setattr(feedback_uow.conversations, "fence_feedback_write", pause_after_fence)
    monkeypatch.setattr(delete_uow.conversations, "delete", pause_before_parent_delete)
    monkeypatch.setattr(delete_uow, "begin", count_begin)

    async def submit_feedback():
        await feedback_uow.feedbacks.save(Feedback(
            f"fb-feedback-first-{iteration}", f"msg-feedback-first-{iteration}", "u1", "positive", tenant_id="t1"
        ))
        await feedback_uow.commit()

    delete_service = ConversationService(
        delete_uow.conversations, delete_uow.messages, delete_uow.feedbacks, delete_uow
    )
    feedback_task = asyncio.create_task(submit_feedback())
    delete_task = None
    try:
        await asyncio.wait_for(feedback_fenced.wait(), timeout=5)
        delete_task = asyncio.create_task(delete_service.delete_conversation("t1", "u1", conv.id))
        await asyncio.wait_for(delete_waiting.wait(), timeout=5)
        assert feedback_uow.session is not delete_uow.session
        finish_feedback.set()
        await asyncio.wait_for(feedback_task, timeout=10)
        finish_delete.set()
        await asyncio.wait_for(delete_task, timeout=15)
        assert begin_count >= 2
        for collection, query in {
            "conversations": {"_id": conv.id},
            "messages": {"conversationId": conv.id},
            "feedback": {"conversationId": conv.id},
            "citation_snapshots": {"conversationId": conv.id},
        }.items():
            assert await mongo_uow.database[collection].count_documents(query) == 0
    finally:
        finish_feedback.set()
        finish_delete.set()
        if delete_task and not delete_task.done():
            delete_task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await delete_task
        await feedback_uow.close()
        await delete_uow.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("iteration", range(3))
async def test_hard_delete_wins_race_and_feedback_is_rejected(mongo_uow, monkeypatch, iteration):
    from app.integrations.database.unit_of_work import UnitOfWork
    from app.services.conversation_service import ConversationService

    conv = conversation(identifier=f"conv-delete-first-{iteration}")
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message(
        f"msg-delete-first-{iteration}", conv.id, "assistant", "answer", datetime.now(UTC),
        citations=[ChatCitation("cit-delete-race", "ev-delete-race", "official", "doc-race", "Doc", 1, 1, "snapshot")],
    ))
    await mongo_uow.commit()

    feedback_uow = UnitOfWork(mongo_uow.client, mongo_uow.database)
    delete_uow = UnitOfWork(mongo_uow.client, mongo_uow.database)
    parent_deleted = asyncio.Event()
    finish_delete = asyncio.Event()
    feedback_fence_started = asyncio.Event()
    original_delete = delete_uow.conversations.delete
    original_fence = feedback_uow.conversations.fence_feedback_write
    original_feedback_begin = feedback_uow.begin
    feedback_begin_count = 0

    async def pause_after_parent_delete(*args, **kwargs):
        result = await original_delete(*args, **kwargs)
        parent_deleted.set()
        await finish_delete.wait()
        return result

    async def signal_feedback_fence(*args, **kwargs):
        feedback_fence_started.set()
        return await original_fence(*args, **kwargs)

    async def count_feedback_begin():
        nonlocal feedback_begin_count
        if not feedback_uow._transaction_active:
            feedback_begin_count += 1
        await original_feedback_begin()

    monkeypatch.setattr(delete_uow.conversations, "delete", pause_after_parent_delete)
    monkeypatch.setattr(feedback_uow.conversations, "fence_feedback_write", signal_feedback_fence)
    monkeypatch.setattr(feedback_uow, "begin", count_feedback_begin)
    delete_service = ConversationService(
        delete_uow.conversations, delete_uow.messages, delete_uow.feedbacks, delete_uow
    )

    async def submit_feedback():
        await feedback_uow.feedbacks.save(Feedback(
            f"fb-delete-first-{iteration}", f"msg-delete-first-{iteration}", "u1", "positive", tenant_id="t1"
        ))
        await feedback_uow.commit()

    delete_task = asyncio.create_task(delete_service.delete_conversation("t1", "u1", conv.id))
    feedback_task = None
    try:
        await asyncio.wait_for(parent_deleted.wait(), timeout=5)
        feedback_task = asyncio.create_task(submit_feedback())
        await asyncio.wait_for(feedback_fence_started.wait(), timeout=5)
        assert feedback_uow.session is not delete_uow.session
        finish_delete.set()
        await asyncio.wait_for(delete_task, timeout=15)
        with pytest.raises(LookupError, match="Assistant message|parent conversation"):
            await asyncio.wait_for(feedback_task, timeout=15)
        assert feedback_begin_count >= 2
        for collection, query in {
            "conversations": {"_id": conv.id},
            "messages": {"conversationId": conv.id},
            "feedback": {"conversationId": conv.id},
            "citation_snapshots": {"conversationId": conv.id},
        }.items():
            assert await mongo_uow.database[collection].count_documents(query) == 0
    finally:
        finish_delete.set()
        if feedback_task and not feedback_task.done():
            feedback_task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await feedback_task
        await delete_uow.close()
        await feedback_uow.close()


@pytest.mark.asyncio
async def test_hard_delete_failure_rolls_back_all_cascade_writes(mongo_uow, monkeypatch):
    from app.services.conversation_service import ConversationService

    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message(
        "msg-delete-rollback", conv.id, "assistant", "answer", datetime.now(UTC),
        citations=[ChatCitation("cit-delete-rollback", "ev-rb", "official", "doc-rb", "Doc", 1, 1, "snapshot")],
    ))
    await mongo_uow.feedbacks.save(Feedback("fb-delete-rollback", "msg-delete-rollback", "u1", "positive", tenant_id="t1"))
    await mongo_uow.commit()

    async def fail_message_delete(*_args, **_kwargs):
        raise RuntimeError("forced cascade failure")

    monkeypatch.setattr(mongo_uow.messages, "delete_by_conversation", fail_message_delete)
    service = ConversationService(
        mongo_uow.conversations, mongo_uow.messages, mongo_uow.feedbacks, mongo_uow
    )
    with pytest.raises(RuntimeError, match="forced cascade failure"):
        await service.delete_conversation("t1", "u1", conv.id)

    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1") is not None
    assert await mongo_uow.database["messages"].count_documents({"conversationId": conv.id}) == 1
    assert await mongo_uow.database["feedback"].count_documents({"conversationId": conv.id}) == 1
    assert await mongo_uow.database["citation_snapshots"].count_documents({"conversationId": conv.id}) == 1


@pytest.mark.asyncio
async def test_hard_delete_commit_failure_aborts_without_partial_writes(mongo_uow, monkeypatch):
    from pymongo.errors import OperationFailure

    from app.services.conversation_service import ConversationService

    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message(
        "msg-commit-failure", conv.id, "assistant", "answer", datetime.now(UTC),
        citations=[ChatCitation("cit-commit-failure", "ev-rb", "official", "doc-rb", "Doc", 1, 1, "snapshot")],
    ))
    await mongo_uow.feedbacks.save(Feedback("fb-commit-failure", "msg-commit-failure", "u1", "positive", tenant_id="t1"))
    await mongo_uow.commit()

    await mongo_uow.begin()
    session_type = type(mongo_uow.session)

    async def fail_commit(_session):
        raise OperationFailure("injected commit failure")

    monkeypatch.setattr(session_type, "commit_transaction", fail_commit)
    service = ConversationService(
        mongo_uow.conversations, mongo_uow.messages, mongo_uow.feedbacks, mongo_uow
    )
    with pytest.raises(OperationFailure, match="injected commit failure"):
        await service.delete_conversation("t1", "u1", conv.id)

    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1") is not None
    assert await mongo_uow.database["messages"].count_documents({"conversationId": conv.id}) == 1
    assert await mongo_uow.database["feedback"].count_documents({"conversationId": conv.id}) == 1
    assert await mongo_uow.database["citation_snapshots"].count_documents({"conversationId": conv.id}) == 1


@pytest.mark.asyncio
async def test_conversation_repository_requires_tenant_and_owner(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.commit()

    with pytest.raises(ValueError, match="tenant_id and user_id"):
        await mongo_uow.conversations.get_by_id(conv.id, "", "u1")
    with pytest.raises(ValueError, match="tenant_id and user_id"):
        await mongo_uow.conversations.get_by_id(conv.id, "t1", "")
    with pytest.raises(ValueError, match="tenant_id and user_id"):
        await mongo_uow.conversations.delete(conv.id, "t1", "")
    with pytest.raises(ValueError, match="tenant_id and user_id"):
        await mongo_uow.conversations.delete(conv.id, "", "u1")
    with pytest.raises(TypeError):
        await mongo_uow.conversations.get_by_id(conv.id, "t1")
    with pytest.raises(TypeError):
        await mongo_uow.conversations.get_by_id(conv.id, user_id="u1")
    with pytest.raises(TypeError):
        await mongo_uow.conversations.delete(conv.id, "t1", hard_delete=True)
    with pytest.raises(TypeError):
        await mongo_uow.conversations.delete(conv.id, user_id="u1", hard_delete=True)

    assert await mongo_uow.conversations.delete(conv.id, "t1", "wrong-owner", hard_delete=True) is False
    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1") is not None


@pytest.mark.asyncio
async def test_conversation_owner_sensitive_access_rejects_cross_tenant(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.commit()

    assert await mongo_uow.conversations.get_by_id(conv.id, "other-tenant", "u1") is None
    assert await mongo_uow.conversations.delete(conv.id, "other-tenant", "u1", hard_delete=True) is False
    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1") is not None


@pytest.mark.asyncio
async def test_feedback_upsert_is_idempotent_and_keeps_id(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message("msg-feedback", conv.id, "assistant", "answer", datetime.now(UTC)))
    fb = Feedback("fb-original", "msg-feedback", "u1", "positive", tenant_id="t1")
    await mongo_uow.feedbacks.save(fb)
    await mongo_uow.commit()
    first_id = fb.id
    await mongo_uow.feedbacks.save(Feedback("fb-new", "msg-feedback", "u1", "negative", tenant_id="t1"))
    await mongo_uow.commit()
    current = await mongo_uow.feedbacks.get_by_message_and_user("msg-feedback", "u1", "t1")
    assert current.id == first_id
    assert current.rating == "negative"
    assert (await mongo_uow.database["conversations"].find_one({"_id": conv.id}))[
        "feedbackFence"
    ] == 2
    assert await mongo_uow.feedbacks.get_by_message_and_user("msg-feedback", "other", "t1") is None
    assert await mongo_uow.feedbacks.get_by_message_and_user("msg-feedback", "u1", "other-tenant") is None


@pytest.mark.asyncio
async def test_feedback_concurrent_upsert_is_atomic_and_keeps_single_id(mongo_uow):
    from app.integrations.database.unit_of_work import UnitOfWork

    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message(
        "msg-feedback-race", conv.id, "assistant", "answer", datetime.now(UTC)))
    await mongo_uow.commit()

    async def submit(identifier, rating):
        uow = UnitOfWork(mongo_uow.client, mongo_uow.database)
        try:
            feedback = Feedback(identifier, "msg-feedback-race", "u1", rating, tenant_id="t1")
            await uow.feedbacks.save(feedback)
            await uow.commit()
            return feedback.id
        finally:
            await uow.close()

    first_id, second_id = await asyncio.gather(
        submit("fb-race-a", "positive"), submit("fb-race-b", "negative"))
    assert first_id == second_id
    assert await mongo_uow.database["feedback"].count_documents({
        "tenantId": "t1", "messageId": "msg-feedback-race", "userId": "u1"}) == 1


@pytest.mark.asyncio
async def test_index_migration_is_idempotent(mongo_uow):
    from scripts.mongodb_migrate import INDEXES, ensure_indexes

    await ensure_indexes(mongo_uow.database)
    for collection_name, specifications in INDEXES.items():
        actual = await mongo_uow.database[collection_name].index_information()
        for spec in specifications:
            _, index_name, *unique = spec
            assert index_name in actual
            assert actual[index_name].get("unique", False) is bool(unique and unique[0])


@pytest.mark.asyncio
async def test_transaction_rollback_removes_conversation_and_children(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    await mongo_uow.messages.save(Message("msg-rollback", conv.id, "assistant", "answer", datetime.now(UTC),
        citations=[ChatCitation("cit-rollback", "ev-rb", "official", "doc-rb", "Doc", 1, 1, "snapshot")]))
    await mongo_uow.rollback()
    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1") is None
    assert await mongo_uow.messages.get_by_id("msg-rollback", "t1", "u1") is None
    assert await mongo_uow.database["citation_snapshots"].count_documents({"messageId": "msg-rollback"}) == 0


@pytest.mark.asyncio
async def test_scoped_delete_removes_feedback_messages_and_snapshots(mongo_uow):
    conv = conversation()
    await mongo_uow.conversations.save(conv)
    citation = ChatCitation("cit-delete", "ev-delete", "official", "doc-delete", "Doc", 1, 2, "snapshot")
    await mongo_uow.messages.save(Message(
        "msg-delete", conv.id, "assistant", "answer", datetime.now(UTC), citations=[citation]))
    await mongo_uow.feedbacks.save(Feedback("fb-delete", "msg-delete", "u1", "positive", tenant_id="t1"))
    await mongo_uow.commit()
    await mongo_uow.begin()
    assert await mongo_uow.feedbacks.delete_by_conversation(conv.id, "t1", "u1") == 1
    assert await mongo_uow.messages.delete_by_conversation(conv.id, "t1", "u1") == 1
    assert await mongo_uow.conversations.delete(conv.id, "t1", "u1", hard_delete=True)
    await mongo_uow.commit()
    assert await mongo_uow.conversations.get_by_id(conv.id, "t1", "u1") is None
    assert await mongo_uow.database["messages"].count_documents({"conversationId": conv.id}) == 0
    assert await mongo_uow.database["feedback"].count_documents({"conversationId": conv.id}) == 0
    assert await mongo_uow.database["citation_snapshots"].count_documents({"messageId": "msg-delete"}) == 0


@pytest.mark.asyncio
async def test_database_outage_fails_without_fallback():
    from pymongo import AsyncMongoClient
    client = AsyncMongoClient("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=250", serverSelectionTimeoutMS=250)
    try:
        with pytest.raises(ServerSelectionTimeoutError):
            await client.admin.command("ping")
    finally:
        await client.close()
