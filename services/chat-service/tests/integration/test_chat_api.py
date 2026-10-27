"""Integration tests for Chat API endpoints."""
import pytest
import httpx
from unittest.mock import AsyncMock
from app.main import app
from app.api.controllers.chat_controller import get_chat_service
from app.ai.pipeline import PipelineResult
from app.domain.value_objects.citation import ChatCitation


def test_chat_api_placeholder():
    """Placeholder test preserved for backward compatibility."""
    assert True


@pytest.mark.asyncio
async def test_ask_course_chat_answered_scenario():
    """POST /api/v1/courses/{course_id}/chat returns 200 with answer and citations."""
    mock_service = AsyncMock()
    mock_citation = ChatCitation(
        citation_id="cit-001",
        evidence_id="ev-101",
        source_type="official",
        document_id="doc-syllabus",
        document_name="Syllabus.pdf",
        page_from=3,
        page_to=3,
        snippet="Học phần gồm 3 tín chỉ lý thuyết.",
    )
    mock_service.answer_question.return_value = PipelineResult(
        result_state="answered",
        answer="Học phần gồm 3 tín chỉ lý thuyết [1].",
        citations=[mock_citation],
        metadata={"model": "gpt-4o"},
    )

    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/courses/course-101/chat",
                json={"question": "Học phần này có mấy tín chỉ?"},
                headers={
                    "X-Request-Id": "req-api-test-1",
                    "X-Tenant-Id": "tenant-abc",
                    "X-User-Id": "user-xyz",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["refused"] is False
        assert data["refusal_reason"] is None
        assert "3 tín chỉ" in data["answer"]
        assert len(data["citations"]) == 1
        cit = data["citations"][0]
        assert cit["document_id"] == "doc-syllabus"
        assert cit["chunk_id"] == "ev-101"
        assert cit["title"] == "Syllabus.pdf"
        assert cit["page_number"] == 3
        assert "3 tín chỉ" in cit["snippet"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ask_course_chat_insufficient_evidence():
    """POST /api/v1/courses/{course_id}/chat returns 200 with safe refusal when evidence is lacking."""
    mock_service = AsyncMock()
    mock_service.answer_question.return_value = PipelineResult(
        result_state="insufficient_evidence",
        answer="Xin lỗi, tài liệu khóa học không chứa đủ thông tin để trả lời.",
        citations=[],
        metadata={"result_state": "insufficient_evidence"},
    )

    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/courses/course-101/chat",
                json={"question": "Thời tiết hôm nay thế nào?"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["refused"] is True
        assert data["refusal_reason"] == "insufficient_evidence"
        assert data["citations"] == []
        assert "Xin lỗi" in data["answer"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ask_course_chat_validation_error_empty_question():
    """POST /api/v1/courses/{course_id}/chat returns 422 when question violates schema constraints."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/courses/course-101/chat",
            json={"question": ""},  # min_length: 1 violation
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_conversations_unauthorized_without_user_id():
    """GET /api/v1/conversations returns 401 when authentication/user identity is missing."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/conversations")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_conversations_list_filter_and_pagination():
    """GET /api/v1/conversations returns 200 with paginated conversations owned by caller."""
    from datetime import datetime, timezone
    from app.domain.entities.conversation import Conversation
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        conv1 = Conversation(
            id="conv-api-1",
            tenant_id="tenant-api",
            user_id="user-api-1",
            course_id="course-api-101",
            source_scope="course_only",
            title="Đại số tuyến tính",
            created_at=now,
            updated_at=now,
        )
        conv2 = Conversation(
            id="conv-api-2",
            tenant_id="tenant-api",
            user_id="user-api-1",
            course_id="course-api-202",
            source_scope="course_only",
            title="Giải tích nâng cao",
            created_at=now,
            updated_at=now,
        )
        conv_other = Conversation(
            id="conv-api-other",
            tenant_id="tenant-api",
            user_id="user-api-other",
            course_id="course-api-101",
            source_scope="course_only",
            title="Học viên khác",
            created_at=now,
            updated_at=now,
        )
        await uow.conversations.save(conv1)
        await uow.conversations.save(conv2)
        await uow.conversations.save(conv_other)
        await uow.commit()

    headers = {
        "X-Tenant-Id": "tenant-api",
        "X-User-Id": "user-api-1",
    }
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # List all for user-api-1
        res = await client.get("/api/v1/conversations", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["successful"] is True
        items = body["data"]["items"]
        assert len(items) == 2
        # Ensure other user's conversation was not returned
        assert all(c["conversation_id"] in ("conv-api-1", "conv-api-2") for c in items)

        # Filter by course_id
        res_filter = await client.get("/api/v1/conversations?course_id=course-api-101", headers=headers)
        assert res_filter.status_code == 200
        filtered_items = res_filter.json()["data"]["items"]
        assert len(filtered_items) == 1
        assert filtered_items[0]["conversation_id"] == "conv-api-1"


@pytest.mark.asyncio
async def test_conversation_detail_and_owner_isolation():
    """GET /api/v1/conversations/{conversationId} returns 200 with messages or 404 if unauthorized."""
    from datetime import datetime, timezone
    from app.domain.entities.conversation import Conversation
    from app.domain.entities.message import Message
    from app.domain.value_objects.citation import ChatCitation
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id="conv-detail-test",
            tenant_id="tenant-sec",
            user_id="user-owner",
            course_id="course-sec",
            source_scope="course_only",
            title="Bảo mật ứng dụng",
            created_at=now,
            updated_at=now,
        )
        u_msg = Message(
            id="msg-u-detail",
            conversation_id="conv-detail-test",
            role="user",
            content="Cách phòng chống SQL Injection?",
            created_at=now,
        )
        cit = ChatCitation(
            citation_id="cit-sec-1",
            evidence_id="ev-sec-1",
            source_type="official",
            document_id="doc-owasp",
            document_name="OWASP_Top_10.pdf",
            page_from=5,
            page_to=6,
            snippet="Sử dụng parameterized queries để ngăn ngừa SQL injection.",
        )
        a_msg = Message(
            id="msg-a-detail",
            conversation_id="conv-detail-test",
            role="assistant",
            content="Sử dụng parameterized queries [1].",
            status="answered",
            refused=False,
            citations=[cit],
            created_at=now,
        )
        await uow.conversations.save(conv)
        await uow.messages.save(u_msg)
        await uow.messages.save(a_msg)
        await uow.commit()

    owner_headers = {"X-Tenant-Id": "tenant-sec", "X-User-Id": "user-owner"}
    other_headers = {"X-Tenant-Id": "tenant-sec", "X-User-Id": "user-other"}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Owner can view details and messages
        res = await client.get("/api/v1/conversations/conv-detail-test", headers=owner_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["successful"] is True
        data = body["data"]
        assert data["conversation_id"] == "conv-detail-test"
        assert len(data["messages"]) == 2
        asst = data["messages"][1]
        assert asst["role"] == "assistant"
        assert len(asst["citations"]) == 1
        assert asst["citations"][0]["document_id"] == "doc-owasp"

        # 2. Non-owner receives 404 (preventing resource existence disclosure)
        res_other = await client.get("/api/v1/conversations/conv-detail-test", headers=other_headers)
        assert res_other.status_code == 404

        # 3. Non-existent conversation receives 404
        res_missing = await client.get("/api/v1/conversations/conv-does-not-exist", headers=owner_headers)
        assert res_missing.status_code == 404


@pytest.mark.asyncio
async def test_conversation_deletion_and_cleanup():
    """DELETE /api/v1/conversations/{conversationId} deletes conversation data and returns 200."""
    from datetime import datetime, timezone
    from app.domain.entities.conversation import Conversation
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id="conv-to-delete",
            tenant_id="tenant-del",
            user_id="user-del",
            course_id="c1",
            source_scope="course_only",
            title="Cuộc trò chuyện cần xóa",
            created_at=now,
            updated_at=now,
        )
        await uow.conversations.save(conv)
        await uow.commit()

    headers = {"X-Tenant-Id": "tenant-del", "X-User-Id": "user-del"}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Delete conversation
        del_res = await client.delete("/api/v1/conversations/conv-to-delete", headers=headers)
        assert del_res.status_code == 200
        del_body = del_res.json()
        assert del_body["successful"] is True
        assert del_body["data"]["conversation_id"] == "conv-to-delete"
        assert del_body["data"]["deleted"] is True

        # Subsequent GET returns 404
        get_res = await client.get("/api/v1/conversations/conv-to-delete", headers=headers)
        assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_submit_message_feedback_endpoint():
    """POST /api/v1/messages/{messageId}/feedback creates and updates feedback for assistant messages."""
    from datetime import datetime, timezone
    from app.domain.entities.message import Message
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        asst_msg = Message(
            id="msg-fb-asst",
            conversation_id="conv-fb",
            role="assistant",
            content="Đây là câu trả lời trợ lý.",
            created_at=now,
        )
        user_msg = Message(
            id="msg-fb-user",
            conversation_id="conv-fb",
            role="user",
            content="Câu hỏi học viên.",
            created_at=now,
        )
        await uow.messages.save(asst_msg)
        await uow.messages.save(user_msg)
        await uow.commit()

    headers = {"X-Tenant-Id": "tenant-fb", "X-User-Id": "user-fb"}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthorized without user header
        no_auth_res = await client.post(
            "/api/v1/messages/msg-fb-asst/feedback",
            json={"rating": "positive", "comment": "Hữu ích"},
        )
        assert no_auth_res.status_code == 401

        # 2. Non-existent message returns 404
        not_found_res = await client.post(
            "/api/v1/messages/msg-non-existent/feedback",
            json={"rating": "positive"},
            headers=headers,
        )
        assert not_found_res.status_code == 404

        # 3. Submitting feedback for user message returns 400
        user_msg_res = await client.post(
            "/api/v1/messages/msg-fb-user/feedback",
            json={"rating": "positive"},
            headers=headers,
        )
        assert user_msg_res.status_code == 400

        # 4. Invalid rating returns 422
        invalid_rating_res = await client.post(
            "/api/v1/messages/msg-fb-asst/feedback",
            json={"rating": "neutral"},
            headers=headers,
        )
        assert invalid_rating_res.status_code == 422

        # 5. Successful positive feedback
        ok_res = await client.post(
            "/api/v1/messages/msg-fb-asst/feedback",
            json={"rating": "positive", "comment": "Giải thích chuẩn xác"},
            headers=headers,
        )
        assert ok_res.status_code == 200
        fb_data = ok_res.json()
        assert fb_data["successful"] is True
        assert fb_data["data"]["rating"] == "positive"
        assert fb_data["data"]["message_id"] == "msg-fb-asst"
        first_fb_id = fb_data["data"]["feedback_id"]

        # 6. Idempotent update on duplicate submission
        update_res = await client.post(
            "/api/v1/messages/msg-fb-asst/feedback",
            json={"rating": "negative", "comment": "Cần thêm ví dụ cụ thể"},
            headers=headers,
        )
        assert update_res.status_code == 200
        updated_data = update_res.json()
        assert updated_data["successful"] is True
        assert updated_data["data"]["rating"] == "negative"
        # Same feedback ID updated
        assert updated_data["data"]["feedback_id"] == first_fb_id


@pytest.mark.asyncio
async def test_conversations_invalid_cursor_returns_400():
    """GET /api/v1/conversations with malformed cursor returns 400 BadRequest with ApiFailureResponse."""
    headers = {"X-Tenant-Id": "t1", "X-User-Id": "u1"}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/conversations?cursor=not-a-valid-cursor", headers=headers)
        assert res.status_code == 400
        body = res.json()
        assert body["successful"] is False
        assert body["data"] is None
        assert body["error"]["errorCode"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_conversation_messages_pagination_with_next_cursor():
    """GET /api/v1/conversations/{conversationId} returns next_cursor when more messages exist."""
    from datetime import datetime, timezone, timedelta
    from app.domain.entities.conversation import Conversation
    from app.domain.entities.message import Message
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id="conv-pag-api",
            tenant_id="tenant-pag",
            user_id="user-pag",
            course_id="c1",
            source_scope="course_only",
            title="Pagination test",
            created_at=now,
            updated_at=now,
        )
        await uow.conversations.save(conv)
        for i in range(3):
            msg = Message(
                id=f"msg-pag-{i}",
                conversation_id="conv-pag-api",
                role="user" if i % 2 == 0 else "assistant",
                content=f"Message {i}",
                created_at=now + timedelta(seconds=i * 10),
            )
            await uow.messages.save(msg)
        await uow.commit()

    headers = {"X-Tenant-Id": "tenant-pag", "X-User-Id": "user-pag"}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Page 1: limit 2
        res1 = await client.get("/api/v1/conversations/conv-pag-api?limit=2", headers=headers)
        assert res1.status_code == 200
        b1 = res1.json()
        assert len(b1["data"]["messages"]) == 2
        next_cur = b1["data"]["next_cursor"]
        assert next_cur is not None

        # Page 2: with cursor
        res2 = await client.get(f"/api/v1/conversations/conv-pag-api?limit=2&cursor={next_cur}", headers=headers)
        assert res2.status_code == 200
        b2 = res2.json()
        assert len(b2["data"]["messages"]) == 1
        assert b2["data"]["messages"][0]["message_id"] == "msg-pag-2"
        assert b2["data"]["next_cursor"] is None


@pytest.mark.asyncio
async def test_chat_course_mismatch_returns_409_conflict():
    """POST /api/v1/courses/{course_id}/chat returns 409 Conflict when conversation belongs to another course."""
    from datetime import datetime, timezone
    from app.domain.entities.conversation import Conversation
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id="conv-for-course-A",
            tenant_id="tenant-conf",
            user_id="user-conf",
            course_id="course-A",
            source_scope="course_only",
            title="Course A conversation",
            created_at=now,
            updated_at=now,
        )
        await uow.conversations.save(conv)
        await uow.commit()

    headers = {
        "X-Tenant-Id": "tenant-conf",
        "X-User-Id": "user-conf",
    }
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with course-B for conversation that belongs to course-A
        res = await client.post(
            "/api/v1/courses/course-B/chat",
            json={
                "question": "Can I continue here?",
                "conversation_id": "conv-for-course-A",
            },
            headers=headers,
        )
        assert res.status_code == 409
        body = res.json()
        assert body["successful"] is False
        assert body["data"] is None
        assert body["error"]["errorCode"] == "CONFLICT"


@pytest.mark.asyncio
async def test_chat_response_contains_complete_data_envelope():
    """POST /api/v1/courses/{course_id}/chat returns data envelope conforming to OpenAPI specification."""
    mock_service = AsyncMock()
    mock_cit = ChatCitation(
        citation_id="cit-env-1",
        evidence_id="ev-env-1",
        source_type="official",
        document_id="doc-env",
        document_name="Env.pdf",
        page_from=1,
        page_to=1,
        snippet="Envelope citation snippet",
    )
    mock_service.answer_question.return_value = PipelineResult(
        result_state="answered",
        answer="Answer with envelope [1].",
        citations=[mock_cit],
        metadata={"variant": "A", "retriever_version": "1.0", "latency_ms": 12},
    )

    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        headers = {
            "X-Request-Id": "req-envelope-test",
            "X-Tenant-Id": "tenant-env",
            "X-User-Id": "user-env",
        }
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/v1/courses/course-101/chat",
                json={"question": "Test query for envelope"},
                headers=headers,
            )
            assert res.status_code == 200
            body = res.json()
            # Check ApiSuccessResponse envelope
            assert body["successful"] is True
            assert body["data"] is not None
            assert body["data"]["request_id"] == "req-envelope-test"
            assert "conversation_id" in body["data"]
            assert "message_id" in body["data"]
            assert body["data"]["status"] == "answered"
            assert body["data"]["source_scope"] == "course_only"
            assert body["data"]["answer"] == "Answer with envelope [1]."
            assert len(body["data"]["citations"]) == 1
            assert body["data"]["citations"][0]["citation_id"] == "cit-env-1"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_personal_documents_chat_endpoint_success():
    """POST /api/v1/personal-documents/chat returns 200 with personal_only scope and valid envelope."""
    mock_service = AsyncMock()
    mock_cit = ChatCitation(
        citation_id="cit-p-1",
        evidence_id="ev-p-1",
        source_type="personal",
        document_id="doc-personal-note",
        document_name="Notes.pdf",
        page_from=1,
        page_to=1,
        snippet="Ghi chú cá nhân",
    )
    mock_service.answer_question.return_value = PipelineResult(
        result_state="answered",
        answer="Ghi chú cá nhân chỉ ra [1].",
        citations=[mock_cit],
        metadata={"variant": "A"},
    )

    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        headers = {
            "X-Request-Id": "req-pers-1",
            "X-Tenant-Id": "tenant-p",
            "X-User-Id": "user-p",
        }
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/v1/personal-documents/chat",
                json={"question": "Hỏi trong ghi chú cá nhân?"},
                headers=headers,
            )
            assert res.status_code == 200
            body = res.json()
            assert body["successful"] is True
            assert body["source_scope"] == "personal_only"
            assert body["data"]["source_scope"] == "personal_only"
            assert "Ghi chú cá nhân" in body["answer"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_chat_cross_scope_conflicts_return_409():
    """Verify 409 Conflict across course-vs-personal mismatch and source_scope incompatibility."""
    from datetime import datetime, timezone
    from app.domain.entities.conversation import Conversation
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        # 1. Course conversation
        c_course = Conversation(
            id="conv-crs-scope-test",
            tenant_id="t-scope",
            user_id="u-scope",
            course_id="math-101",
            source_scope="course_only",
            title="Course Math",
            created_at=now,
            updated_at=now,
        )
        # 2. Personal conversation
        c_pers = Conversation(
            id="conv-pers-scope-test",
            tenant_id="t-scope",
            user_id="u-scope",
            course_id=None,
            source_scope="personal_only",
            title="Personal Notes",
            created_at=now,
            updated_at=now,
        )
        await uow.conversations.save(c_course)
        await uow.conversations.save(c_pers)
        await uow.commit()

    headers = {"X-Tenant-Id": "t-scope", "X-User-Id": "u-scope"}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # A: Passing course conversation into /personal-documents/chat -> 409
        res_pers = await client.post(
            "/api/v1/personal-documents/chat",
            json={"question": "Ask personal", "conversation_id": "conv-crs-scope-test"},
            headers=headers,
        )
        assert res_pers.status_code == 409
        assert res_pers.json()["error"]["errorCode"] == "CONFLICT"

        # B: Passing personal conversation into /courses/{course_id}/chat -> 409
        res_crs = await client.post(
            "/api/v1/courses/math-101/chat",
            json={"question": "Ask course", "conversation_id": "conv-pers-scope-test"},
            headers=headers,
        )
        assert res_crs.status_code == 409
        assert res_crs.json()["error"]["errorCode"] == "CONFLICT"

        # C: Passing course_only conversation with combined scope -> 409
        res_combined = await client.post(
            "/api/v1/courses/math-101/chat",
            json={
                "question": "Ask combined",
                "conversation_id": "conv-crs-scope-test",
                "source_scope": "combined",
            },
            headers=headers,
        )
        assert res_combined.status_code == 409
        assert res_combined.json()["error"]["errorCode"] == "CONFLICT"


@pytest.mark.asyncio
async def test_conversation_deletion_purges_associated_messages_and_feedback():
    """DELETE /api/v1/conversations/{conversationId} cascades deletion to messages and feedback."""
    from datetime import datetime, timezone
    from app.domain.entities.conversation import Conversation
    from app.domain.entities.message import Message
    from app.domain.entities.feedback import Feedback
    from app.integrations.database.session import AsyncSessionLocal, ensure_db_initialized
    from app.integrations.database.unit_of_work import UnitOfWork

    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id="conv-cascade-del",
            tenant_id="t-casc",
            user_id="u-casc",
            course_id="c1",
            source_scope="course_only",
            title="Cascade delete",
            created_at=now,
            updated_at=now,
        )
        m_asst = Message(
            id="msg-casc-asst",
            conversation_id="conv-cascade-del",
            role="assistant",
            content="Answer cascade",
            created_at=now,
        )
        fb = Feedback(
            id="fb-casc",
            message_id="msg-casc-asst",
            user_id="u-casc",
            rating="positive",
            comment="Great answer",
            created_at=now,
        )
        await uow.conversations.save(conv)
        await uow.messages.save(m_asst)
        await uow.feedbacks.save(fb)
        await uow.commit()

    headers = {"X-Tenant-Id": "t-casc", "X-User-Id": "u-casc"}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Delete conversation
        del_res = await client.delete("/api/v1/conversations/conv-cascade-del", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["data"]["deleted"] is True

        # Verify conversation is gone
        get_res = await client.get("/api/v1/conversations/conv-cascade-del", headers=headers)
        assert get_res.status_code == 404

    # Direct database verification that message and feedback rows were purged
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        msg_found = await uow.messages.get_by_id("msg-casc-asst")
        assert msg_found is None
        fb_found = await uow.feedbacks.get_by_message_and_user("msg-casc-asst", "u-casc")
        assert fb_found is None


@pytest.mark.asyncio
async def test_ask_course_chat_with_dict_citations():
    """POST /api/v1/courses/{course_id}/chat correctly serializes citations returned as dictionaries."""
    mock_service = AsyncMock()
    dict_citation = {
        "citation_id": "cit-dict-999",
        "evidence_id": "ev-dict-999",
        "source_type": "official",
        "document_id": "doc-syllabus-dict",
        "document_name": "Syllabus2026.pdf",
        "page_from": 2,
        "page_to": 3,
        "snippet": "Quy định đánh giá giữa kỳ.",
    }
    mock_service.answer_question.return_value = PipelineResult(
        result_state="answered",
        answer="Quy định đánh giá giữa kỳ [1].",
        citations=[dict_citation],
        metadata={"model": "gpt-4o"},
    )

    app.dependency_overrides[get_chat_service] = lambda: mock_service
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/courses/course-dict-test/chat",
                json={"question": "Quy chế giữa kỳ thế nào?"},
                headers={
                    "X-Request-Id": "req-dict-test",
                    "X-Tenant-Id": "tenant-dict",
                    "X-User-Id": "user-dict",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data["citations"]) == 1
        cit = data["citations"][0]
        assert cit["document_id"] == "doc-syllabus-dict"
        assert cit["title"] == "Syllabus2026.pdf"
        assert cit["page_number"] == 2
        assert cit["snippet"] == "Quy định đánh giá giữa kỳ."
        assert cit["evidence_id"] == "ev-dict-999"
    finally:
        app.dependency_overrides.clear()


