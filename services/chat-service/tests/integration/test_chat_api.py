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
