"""Contract tests for Retrieval Service integration."""
import pytest
from app.ai.retrieval.schemas import SearchRequest
from app.ai.retrieval.mapper import RetrievalMapper
from app.domain.value_objects.evidence import Evidence


def test_retrieval_contract_placeholder():
    """Placeholder test preserved for backward compatibility."""
    assert True


def test_search_request_conforms_to_document_v1_contract():
    """Verify SearchRequest payload matches contracts/openapi/document.v1.yaml SearchRequest schema."""
    req = SearchRequest(
        tenant_id="tenant-100",
        course_id="course-200",
        actor_user_id="user-300",
        query="What is the exam schedule?",
        candidate_k=10,
        request_id="req-custom-1",
    )
    payload = req.to_payload()

    # Required fields in document.v1.yaml SearchRequest
    required_keys = {"tenantId", "courseId", "actorUserId", "query", "candidateK", "requestId"}
    assert required_keys.issubset(payload.keys())

    # additionalProperties: false - verify no unexpected keys
    allowed_keys = required_keys.union({"expectedIndexVersion"})
    assert set(payload.keys()).issubset(allowed_keys)

    assert payload["tenantId"] == "tenant-100"
    assert payload["courseId"] == "course-200"
    assert payload["actorUserId"] == "user-300"
    assert payload["query"] == "What is the exam schedule?"
    assert payload["candidateK"] == 10
    assert payload["requestId"] == "req-custom-1"


def test_search_request_camel_case_initialization():
    """Verify SearchRequest can be populated using OpenAPI camelCase field names."""
    req = SearchRequest(
        tenantId="tenant-xyz",
        courseId="course-xyz",
        actorUserId="user-xyz",
        query="How to register?",
        candidateK=5,
        requestId="req-xyz",
        expectedIndexVersion="v1",
    )
    payload = req.to_payload()

    assert payload["tenantId"] == "tenant-xyz"
    assert payload["courseId"] == "course-xyz"
    assert payload["actorUserId"] == "user-xyz"
    assert payload["query"] == "How to register?"
    assert payload["candidateK"] == 5
    assert payload["requestId"] == "req-xyz"
    assert payload["expectedIndexVersion"] == "v1"


def test_candidate_mapping_preserves_document_v1_fields():
    """Verify returned candidates map to domain Evidence preserving all OpenAPI contract fields."""
    raw_response = {
        "successful": True,
        "data": {
            "requestId": "req-999",
            "indexVersion": "v2",
            "embeddingModelVersion": "text-embedding-3-small",
            "candidates": [
                {
                    "evidenceId": "ev-999-1",
                    "chunkId": "chunk-101",
                    "documentId": "doc-555",
                    "documentVersion": 3,
                    "documentName": "AI_Curriculum.pdf",
                    "pageFrom": 7,
                    "pageTo": 9,
                    "text": "Deep Learning principles are taught in semester 2.",
                    "retrievalScore": 0.884,
                }
            ],
        },
        "error": None,
    }

    evidence_list = RetrievalMapper.to_domain(raw_response)
    assert len(evidence_list) == 1
    ev = evidence_list[0]

    assert isinstance(ev, Evidence)
    # Verification of all 8 fields requested in R1
    assert ev.evidenceId == "ev-999-1"
    assert ev.evidence_id == "ev-999-1"
    assert ev.documentId == "doc-555"
    assert ev.document_id == "doc-555"
    assert ev.documentName == "AI_Curriculum.pdf"
    assert ev.document_name == "AI_Curriculum.pdf"
    assert ev.documentVersion == 3
    assert ev.document_version == 3
    assert ev.pageFrom == 7
    assert ev.page_from == 7
    assert ev.pageTo == 9
    assert ev.page_to == 9
    assert ev.text == "Deep Learning principles are taught in semester 2."
    assert abs(ev.retrievalScore - 0.884) < 1e-5
    assert abs(ev.retrieval_score - 0.884) < 1e-5


def test_candidate_mapping_retrieval_evidence_snake_case():
    """Verify compatibility with contracts/openapi/retrieval-evidence.yaml schemas."""
    raw_response = {
        "successful": True,
        "data": {
            "request_id": "req-snake-1",
            "retriever_version": "v1.2",
            "candidates": [
                {
                    "evidence_id": "ev-snake-01",
                    "chunk_id": "chunk-snake-01",
                    "document_id": "doc-snake-01",
                    "document_version": 1,
                    "source_type": "personal",
                    "document_name": "PersonalNotes.pdf",
                    "page_from": 2,
                    "page_to": 2,
                    "text": "Notes on gradient descent.",
                    "retrieval_score": 0.775,
                }
            ],
        },
        "error": None,
    }

    evidence_list = RetrievalMapper.to_domain(raw_response)
    assert len(evidence_list) == 1
    ev = evidence_list[0]

    assert ev.evidence_id == "ev-snake-01"
    assert ev.source_type == "personal"
    assert ev.document_name == "PersonalNotes.pdf"
    assert ev.page_from == 2
    assert ev.page_to == 2
    assert ev.text == "Notes on gradient descent."
    assert abs(ev.retrieval_score - 0.775) < 1e-5


def test_candidate_mapping_handles_null_and_empty_payloads():
    """Verify RetrievalMapper handles null/None candidate keys without throwing TypeError."""
    assert RetrievalMapper.to_domain({"data": {"candidates": None}}) == []
    assert RetrievalMapper.to_domain({"candidates": None}) == []
    assert RetrievalMapper.to_domain({"data": {"candidates": [None, None]}}) == []
    assert RetrievalMapper.to_domain({}) == []
    assert RetrievalMapper.to_domain(None) == []


def test_evidence_creation_safely_handles_malformed_types():
    """Verify Evidence value object safely falls back when types are malformed."""
    ev = Evidence.from_dict({
        "evidenceId": "ev-mal-1",
        "documentId": "doc-mal-1",
        "documentName": "Mal.pdf",
        "pageFrom": "N/A",  # unparseable int
        "pageTo": "invalid",
        "retrievalScore": "unknown",  # unparseable float
        "documentVersion": "v1.2",
    })
    assert ev.page_from == 1
    assert ev.page_to == 1
    assert ev.retrieval_score == 0.0
    assert ev.document_version == 1


def test_evidence_gate_handles_malformed_scores_without_crashing():
    """Verify EvidenceGate evaluates and filters malformed scores without crashing."""
    from app.ai.evidence_gate import EvidenceGate
    gate = EvidenceGate(min_confidence=0.65)

    malformed_candidates = [
        {"evidenceId": "1", "retrievalScore": "invalid"},
        {"evidenceId": "2", "retrievalScore": None},
        {"evidenceId": "3", "retrievalScore": 0.85},
    ]
    assert gate.evaluate(malformed_candidates) is True
    filtered = gate.filter_evidence(malformed_candidates)
    assert len(filtered) == 1
    assert filtered[0]["evidenceId"] == "3"


@pytest.mark.asyncio
async def test_retrieval_http_client_handles_successful_false_envelope_on_200():
    """Verify RetrievalServiceHttpClient parses and rejects successful: false envelopes on HTTP 200."""
    import pytest
    import httpx
    from app.integrations.retrieval_service.http_client import RetrievalServiceHttpClient
    from app.integrations.retrieval_service.exceptions import RetrievalServiceUnavailableException

    error_response = {
        "successful": False,
        "data": None,
        "error": {
            "errorCode": "INDEX_NOT_READY",
            "errorMessage": "Index is rebuilding for tenant",
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=error_response)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        client = RetrievalServiceHttpClient(client=async_client)
        with pytest.raises(RetrievalServiceUnavailableException) as exc_info:
            await client.post_search({"query": "test"})
        assert "INDEX_NOT_READY" in str(exc_info.value) or "Index is rebuilding" in str(exc_info.value)

