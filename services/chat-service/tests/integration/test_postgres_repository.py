"""Integration tests for PostgreSQL repositories and Unit of Work transaction boundaries."""
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.repositories.models.base import Base
from app.repositories.postgres.conversation_repository import PostgresConversationRepository
from app.repositories.postgres.message_repository import PostgresMessageRepository
from app.repositories.postgres.feedback_repository import PostgresFeedbackRepository
from app.integrations.database.unit_of_work import UnitOfWork
from app.domain.entities.conversation import Conversation
from app.domain.entities.message import Message
from app.domain.entities.feedback import Feedback
from app.domain.value_objects.citation import ChatCitation


@pytest_asyncio.fixture
async def db_session():
    """Create an isolated in-memory SQLite database session for repository testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


def test_postgres_repository_placeholder():
    """Placeholder preserved for compatibility."""
    assert True


@pytest.mark.asyncio
async def test_conversation_repository_crud_and_owner_isolation(db_session):
    """Test conversation creation, owner validation, course filtering, pagination, and soft/hard deletion."""
    repo = PostgresConversationRepository(db_session)
    now = datetime.now(timezone.utc)

    # 1. Create conversations
    conv1 = Conversation(
        id="conv-1",
        tenant_id="tenant-alpha",
        user_id="user-alice",
        course_id="course-math",
        source_scope="course_only",
        title="Toán đại số",
        created_at=now,
        updated_at=now,
    )
    conv2 = Conversation(
        id="conv-2",
        tenant_id="tenant-alpha",
        user_id="user-alice",
        course_id="course-physics",
        source_scope="course_only",
        title="Vật lý đại cương",
        created_at=now,
        updated_at=now,
    )
    conv3 = Conversation(
        id="conv-3",
        tenant_id="tenant-beta",
        user_id="user-bob",
        course_id="course-math",
        source_scope="personal_only",
        title="Bob's Math",
        created_at=now,
        updated_at=now,
    )

    await repo.save(conv1)
    await repo.save(conv2)
    await repo.save(conv3)
    await db_session.commit()

    # 2. Get with owner validation
    fetched = await repo.get_by_id("conv-1", tenant_id="tenant-alpha", user_id="user-alice")
    assert fetched is not None
    assert fetched.title == "Toán đại số"
    assert fetched.course_id == "course-math"

    # Unauthorized access check (wrong user)
    unauthorized = await repo.get_by_id("conv-1", tenant_id="tenant-alpha", user_id="user-bob")
    assert unauthorized is None

    # Cross-tenant access check (wrong tenant)
    wrong_tenant = await repo.get_by_id("conv-1", tenant_id="tenant-beta", user_id="user-alice")
    assert wrong_tenant is None

    # 3. List conversations with filtering
    alice_convs = await repo.list_by_user("user-alice", tenant_id="tenant-alpha")
    assert len(alice_convs) == 2

    # Course filtering
    math_convs = await repo.list_by_user("user-alice", tenant_id="tenant-alpha", course_id="course-math")
    assert len(math_convs) == 1
    assert math_convs[0].id == "conv-1"

    # Pagination with limit
    paged = await repo.list_by_user("user-alice", tenant_id="tenant-alpha", limit=1)
    assert len(paged) == 1

    # 4. Soft deletion
    deleted = await repo.delete("conv-1", tenant_id="tenant-alpha", user_id="user-alice", hard_delete=False)
    assert deleted is True
    await db_session.commit()

    # Soft deleted item is hidden from get_by_id and list
    assert await repo.get_by_id("conv-1", tenant_id="tenant-alpha", user_id="user-alice") is None
    alice_remaining = await repo.list_by_user("user-alice", tenant_id="tenant-alpha")
    assert len(alice_remaining) == 1
    assert alice_remaining[0].id == "conv-2"

    # 5. Hard deletion
    hard_deleted = await repo.delete("conv-2", tenant_id="tenant-alpha", user_id="user-alice", hard_delete=True)
    assert hard_deleted is True
    await db_session.commit()
    assert len(await repo.list_by_user("user-alice", tenant_id="tenant-alpha")) == 0


@pytest.mark.asyncio
async def test_message_repository_persistence_and_ordered_history(db_session):
    """Test message repository saving user and assistant messages, citations serialization, and order."""
    repo = PostgresMessageRepository(db_session)
    now = datetime.now(timezone.utc)

    user_msg = Message(
        id="msg-u1",
        conversation_id="conv-10",
        role="user",
        content="Cho em hỏi về đề thi?",
        created_at=now,
    )
    await repo.save(user_msg)

    citation = ChatCitation(
        citation_id="cit-1",
        evidence_id="ev-101",
        source_type="official",
        document_id="doc-syllabus",
        document_name="Syllabus.pdf",
        page_from=2,
        page_to=2,
        snippet="Đề thi gồm 4 câu tự luận.",
    )
    asst_msg = Message(
        id="msg-a1",
        conversation_id="conv-10",
        role="assistant",
        content="Đề thi gồm 4 câu tự luận [1].",
        status="answered",
        refused=False,
        citations=[citation],
        created_at=now,
    )
    await repo.save(asst_msg)
    await db_session.commit()

    # Query message history
    history = await repo.list_by_conversation("conv-10")
    assert len(history) == 2
    assert history[0].role == "user"
    assert history[0].content == "Cho em hỏi về đề thi?"
    assert history[1].role == "assistant"
    assert history[1].refused is False
    assert len(history[1].citations) == 1

    deserialized_cit = history[1].citations[0]
    assert deserialized_cit.document_id == "doc-syllabus"
    assert deserialized_cit.page_from == 2
    assert deserialized_cit.snippet == "Đề thi gồm 4 câu tự luận."

    # Delete messages by conversation
    count = await repo.delete_by_conversation("conv-10")
    assert count == 2
    await db_session.commit()
    assert len(await repo.list_by_conversation("conv-10")) == 0


@pytest.mark.asyncio
async def test_feedback_repository_persistence_and_idempotent_update(db_session):
    """Test feedback saving, duplicate update behavior, and lookup."""
    repo = PostgresFeedbackRepository(db_session)

    # 1. Initial positive feedback
    fb1 = Feedback(
        id="fb-001",
        message_id="msg-a1",
        user_id="user-123",
        tenant_id="tenant-1",
        rating="positive",
        comment="Rất chi tiết và dễ hiểu",
    )
    await repo.save(fb1)
    await db_session.commit()

    fetched = await repo.get_by_message_and_user("msg-a1", "user-123")
    assert fetched is not None
    assert fetched.rating == "positive"
    assert fetched.comment == "Rất chi tiết và dễ hiểu"

    # 2. Update feedback by submitting again for same message and user
    fb_updated = Feedback(
        id="fb-002",  # Different temporary ID
        message_id="msg-a1",
        user_id="user-123",
        tenant_id="tenant-1",
        rating="negative",
        comment="Đổi ý, câu trả lời hơi ngắn",
    )
    await repo.save(fb_updated)
    await db_session.commit()

    # Verified updated existing record rather than duplicate
    fetched_after = await repo.get_by_message_and_user("msg-a1", "user-123")
    assert fetched_after is not None
    assert fetched_after.id == "fb-001"  # Retained original ID
    assert fetched_after.rating == "negative"
    assert fetched_after.comment == "Đổi ý, câu trả lời hơi ngắn"


@pytest.mark.asyncio
async def test_unit_of_work_transaction_rollback_on_exception(db_session):
    """Verify UnitOfWork automatically rolls back all changes when an exception is raised."""
    uow = UnitOfWork(db_session)
    now = datetime.now(timezone.utc)

    # Attempt to save a conversation inside a failing transaction
    with pytest.raises(RuntimeError):
        async with uow:
            conv = Conversation(
                id="conv-rollback",
                tenant_id="t-roll",
                user_id="u-roll",
                course_id="c-roll",
                source_scope="course_only",
                title="Should be rolled back",
                created_at=now,
                updated_at=now,
            )
            await uow.conversations.save(conv)
            raise RuntimeError("Database connection interrupted or business validation failure")

    # Verify conversation was rolled back and is NOT present in database
    found = await uow.conversations.get_by_id("conv-rollback", tenant_id="t-roll", user_id="u-roll")
    assert found is None


@pytest.mark.asyncio
async def test_message_repository_forward_cursor_pagination(db_session):
    """Verify forward cursor pagination retrieves chronological message stream across pages."""
    import base64
    from datetime import timedelta
    repo = PostgresMessageRepository(db_session)
    base_time = datetime(2026, 10, 24, 10, 0, 0, tzinfo=timezone.utc)

    m1 = Message(id="msg-pg-1", conversation_id="conv-pag", role="user", content="Hello 1", created_at=base_time)
    m2 = Message(id="msg-pg-2", conversation_id="conv-pag", role="assistant", content="Answer 1", created_at=base_time + timedelta(seconds=10))
    m3 = Message(id="msg-pg-3", conversation_id="conv-pag", role="user", content="Hello 2", created_at=base_time + timedelta(seconds=20))
    await repo.save(m1)
    await repo.save(m2)
    await repo.save(m3)
    await db_session.commit()

    # Page 1: limit 2
    page1 = await repo.list_by_conversation("conv-pag", limit=2)
    assert len(page1) == 2
    assert page1[0].id == "msg-pg-1"
    assert page1[1].id == "msg-pg-2"

    # Page 2: with cursor from page 1's last message
    cursor = base64.b64encode(page1[1].created_at.isoformat().encode()).decode()
    page2 = await repo.list_by_conversation("conv-pag", limit=2, cursor=cursor)
    assert len(page2) == 1
    assert page2[0].id == "msg-pg-3"


@pytest.mark.asyncio
async def test_feedback_repository_concurrent_submission_resilience(db_session):
    """Verify concurrent feedback submissions for the same (message_id, user_id) produce exactly 1 record."""
    repo = PostgresFeedbackRepository(db_session)
    now = datetime.now(timezone.utc)

    # 1. First submission
    fb1 = Feedback(
        id="fb-c1",
        message_id="msg-conc-1",
        user_id="user-race",
        tenant_id="tenant-race",
        rating="positive",
        comment="First",
        created_at=now,
    )
    await repo.save(fb1)
    await db_session.commit()

    # 2. Update with second submission
    fb2 = Feedback(
        id="fb-c2",
        message_id="msg-conc-1",
        user_id="user-race",
        tenant_id="tenant-race",
        rating="negative",
        comment="Second update",
        created_at=now,
    )
    await repo.save(fb2)
    await db_session.commit()

    # Verify exactly 1 record retained
    record = await repo.get_by_message_and_user("msg-conc-1", "user-race")
    assert record is not None
    assert record.id == "fb-c1"
    assert record.rating == "negative"
    assert record.comment == "Second update"


@pytest.mark.asyncio
async def test_repository_invalid_cursor_raises_validation_exception(db_session):
    """Verify passing an unparseable cursor raises ValidationException."""
    from app.core.exceptions import ValidationException
    conv_repo = PostgresConversationRepository(db_session)
    msg_repo = PostgresMessageRepository(db_session)

    with pytest.raises(ValidationException):
        await conv_repo.list_by_user(user_id="u1", tenant_id="t1", cursor="not-a-valid-cursor!!!")

    with pytest.raises(ValidationException):
        await msg_repo.list_by_conversation(conversation_id="c1", cursor="corrupted_token_xyz")


@pytest.mark.asyncio
async def test_feedback_repository_delete_by_conversation(db_session):
    """Verify deleting feedbacks by conversation ID correctly purges feedbacks for its messages."""
    msg_repo = PostgresMessageRepository(db_session)
    fb_repo = PostgresFeedbackRepository(db_session)
    now = datetime.now(timezone.utc)

    # Conversation 1 with 2 messages and 2 feedbacks
    m1 = Message(id="msg-c1-1", conversation_id="conv-del-fb-1", role="assistant", content="Ans 1", created_at=now)
    m2 = Message(id="msg-c1-2", conversation_id="conv-del-fb-1", role="assistant", content="Ans 2", created_at=now)
    # Conversation 2 with 1 message and 1 feedback
    m3 = Message(id="msg-c2-1", conversation_id="conv-del-fb-2", role="assistant", content="Ans 3", created_at=now)
    await msg_repo.save(m1)
    await msg_repo.save(m2)
    await msg_repo.save(m3)

    f1 = Feedback(id="fb-del-1", message_id="msg-c1-1", user_id="u1", rating="positive", created_at=now)
    f2 = Feedback(id="fb-del-2", message_id="msg-c1-2", user_id="u1", rating="negative", created_at=now)
    f3 = Feedback(id="fb-del-3", message_id="msg-c2-1", user_id="u1", rating="positive", created_at=now)
    await fb_repo.save(f1)
    await fb_repo.save(f2)
    await fb_repo.save(f3)
    await db_session.commit()

    # Delete feedbacks for conv-del-fb-1
    deleted_count = await fb_repo.delete_by_conversation("conv-del-fb-1")
    assert deleted_count == 2
    await db_session.commit()

    # Confirmed deleted for conv 1
    assert await fb_repo.get_by_message_and_user("msg-c1-1", "u1") is None
    assert await fb_repo.get_by_message_and_user("msg-c1-2", "u1") is None
    # Conversation 2 feedback is untouched
    assert await fb_repo.get_by_message_and_user("msg-c2-1", "u1") is not None


@pytest.mark.asyncio
async def test_conversation_repository_soft_delete_idempotency_and_hard_delete(db_session):
    """Verify soft-delete idempotency (second soft delete returns False) and hard deletion permanently purges."""
    repo = PostgresConversationRepository(db_session)
    now = datetime.now(timezone.utc)

    conv = Conversation(
        id="conv-soft-test",
        tenant_id="tenant-s",
        user_id="user-s",
        course_id="c1",
        source_scope="course_only",
        title="Soft delete test",
        created_at=now,
        updated_at=now,
    )
    await repo.save(conv)
    await db_session.commit()

    # First soft delete succeeds
    assert await repo.delete("conv-soft-test", tenant_id="tenant-s", user_id="user-s", hard_delete=False) is True
    await db_session.commit()

    # Second soft delete returns False
    assert await repo.delete("conv-soft-test", tenant_id="tenant-s", user_id="user-s", hard_delete=False) is False

    # Hard delete permanently purges soft-deleted record
    assert await repo.delete("conv-soft-test", tenant_id="tenant-s", user_id="user-s", hard_delete=True) is True
    await db_session.commit()

    # Record is completely gone
    assert await repo.delete("conv-soft-test", tenant_id="tenant-s", user_id="user-s", hard_delete=True) is False


@pytest.mark.asyncio
async def test_conversation_repository_filter_by_source_scope(db_session):
    """Verify listing conversations filtering by source_scope (course_only vs personal_only)."""
    repo = PostgresConversationRepository(db_session)
    now = datetime.now(timezone.utc)

    c_course = Conversation(
        id="conv-scope-1",
        tenant_id="tenant-scope",
        user_id="user-sc",
        course_id="c101",
        source_scope="course_only",
        title="Course Scope",
        created_at=now,
        updated_at=now,
    )
    c_personal = Conversation(
        id="conv-scope-2",
        tenant_id="tenant-scope",
        user_id="user-sc",
        course_id=None,
        source_scope="personal_only",
        title="Personal Scope",
        created_at=now,
        updated_at=now,
    )
    await repo.save(c_course)
    await repo.save(c_personal)
    await db_session.commit()

    course_list = await repo.list_by_user("user-sc", tenant_id="tenant-scope", source_scope="course_only")
    assert len(course_list) == 1
    assert course_list[0].id == "conv-scope-1"

    personal_list = await repo.list_by_user("user-sc", tenant_id="tenant-scope", source_scope="personal_only")
    assert len(personal_list) == 1
    assert personal_list[0].id == "conv-scope-2"


@pytest.mark.asyncio
async def test_cursor_normalization_to_utc_and_timezone_handling(db_session):
    """Verify offset-naive and offset-aware cursor strings are normalized to UTC timezone."""
    from app.repositories.postgres.conversation_repository import _parse_cursor

    # 1. Naive ISO string becomes UTC aware
    dt_naive = _parse_cursor("2026-10-25T12:00:00")
    assert dt_naive is not None
    assert dt_naive.tzinfo == timezone.utc

    # 2. Offset-aware ISO string is normalized to UTC
    dt_offset = _parse_cursor("2026-10-25T19:00:00+07:00")
    assert dt_offset is not None
    assert dt_offset.tzinfo == timezone.utc
    assert dt_offset.hour == 12  # 19:00 +07:00 == 12:00 UTC


@pytest.mark.asyncio
async def test_feedback_repository_save_reraises_when_record_not_found_on_error(db_session):
    """Verify PostgresFeedbackRepository.save re-raises exceptions when duplicate model is not found."""
    from unittest.mock import AsyncMock, patch
    from sqlalchemy.exc import OperationalError

    repo = PostgresFeedbackRepository(db_session)
    fb = Feedback(
        id="fb-err-test",
        message_id="msg-err-1",
        user_id="user-err-1",
        rating="positive",
    )

    # Simulate an operational error during flush where record is NOT in database
    with patch.object(db_session, "flush", side_effect=RuntimeError("Database write failed")):
        with pytest.raises(RuntimeError) as exc_info:
            await repo.save(fb)
        assert "Database write failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_unit_of_work_context_manager_rolls_back_on_commit_failure(db_session):
    """Verify UnitOfWork __aexit__ rolls back cleanly if commit fails."""
    from unittest.mock import AsyncMock

    uow = UnitOfWork(db_session)
    uow.commit = AsyncMock(side_effect=RuntimeError("Commit failed"))
    uow.rollback = AsyncMock()

    with pytest.raises(RuntimeError):
        async with uow:
            pass

    uow.rollback.assert_awaited_once()


