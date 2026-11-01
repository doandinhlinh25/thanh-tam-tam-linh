"""Contract tests for Retrieval Service integration."""
import math
import json
import pytest
from app.ai.retrieval.schemas import SearchRequest
from app.ai.retrieval.mapper import RetrievalMapper
from app.ai.context_builder import ContextBuilder
from app.domain.value_objects.evidence import Evidence
from app.integrations.retrieval_service.exceptions import RetrievalInvalidResponseException


VALID_DOCUMENT_CANDIDATE = {
    "evidenceId": "ev-f1",
    "chunkId": "chunk-f1",
    "documentId": "doc-f1",
    "documentVersion": 2,
    "documentName": "Course.pdf",
    "pageFrom": 3,
    "pageTo": 4,
    "text": "Verified course content",
    "retrievalScore": 0.9,
}
VALID_SNAKE_CANDIDATE = {
    "evidence_id": "ev-snake-f1",
    "chunk_id": "chunk-snake-f1",
    "document_id": "doc-snake-f1",
    "document_version": 2,
    "source_type": "personal",
    "document_name": "Notes.pdf",
    "page_from": 3,
    "page_to": 4,
    "text": "Verified personal content",
    "retrieval_score": 0.9,
}


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


def test_candidate_mapping_accepts_only_valid_empty_evidence():
    """A valid empty candidate list is the only empty-evidence response."""
    assert RetrievalMapper.to_domain({"successful": True, "data": {"candidates": []}}) == []


@pytest.mark.parametrize("missing_field", tuple(VALID_DOCUMENT_CANDIDATE))
def test_candidate_mapping_rejects_missing_required_document_field(missing_field):
    """Every Document v1 candidate field is required before Evidence creation."""
    candidate = dict(VALID_DOCUMENT_CANDIDATE)
    candidate.pop(missing_field)
    payload = {"successful": True, "data": {"candidates": [candidate]}}

    with pytest.raises(RetrievalInvalidResponseException) as exc_info:
        RetrievalMapper.to_domain(payload)

    assert exc_info.value.status_code == 502
    assert exc_info.value.details == {}


@pytest.mark.parametrize("required_field", tuple(VALID_DOCUMENT_CANDIDATE))
def test_candidate_mapping_rejects_null_required_document_field(required_field):
    """Null values cannot trigger Evidence's permissive defaults."""
    candidate = {**VALID_DOCUMENT_CANDIDATE, required_field: None}
    payload = {"successful": True, "data": {"candidates": [candidate]}}

    with pytest.raises(RetrievalInvalidResponseException):
        RetrievalMapper.to_domain(payload)


@pytest.mark.parametrize(
    "field,invalid_value",
    [
        ("evidenceId", 7),
        ("chunkId", 7),
        ("documentId", 7),
        ("documentName", 7),
        ("text", 7),
        ("documentVersion", 1.5),
        ("documentVersion", 0),
        ("documentVersion", True),
        ("pageFrom", "3"),
        ("pageFrom", 0),
        ("pageTo", "4"),
        ("pageTo", 0),
        ("retrievalScore", "0.9"),
        ("retrievalScore", True),
        ("retrievalScore", math.nan),
        ("retrievalScore", math.inf),
        ("retrievalScore", -math.inf),
    ],
)
def test_candidate_mapping_rejects_invalid_required_document_type(field, invalid_value):
    """Required candidate types and numeric bounds follow the Document schema."""
    candidate = {**VALID_DOCUMENT_CANDIDATE, field: invalid_value}
    payload = {"successful": True, "data": {"candidates": [candidate]}}

    with pytest.raises(RetrievalInvalidResponseException):
        RetrievalMapper.to_domain(payload)


def test_candidate_mapping_keeps_complete_document_values():
    """Complete valid evidence retains its document version, pages and score."""
    payload = {"successful": True, "data": {"candidates": [VALID_DOCUMENT_CANDIDATE]}}

    evidence = RetrievalMapper.to_domain(payload)

    assert len(evidence) == 1
    assert evidence[0].chunk_id == VALID_DOCUMENT_CANDIDATE["chunkId"]
    assert evidence[0].document_version == VALID_DOCUMENT_CANDIDATE["documentVersion"]
    assert evidence[0].page_from == VALID_DOCUMENT_CANDIDATE["pageFrom"]
    assert evidence[0].page_to == VALID_DOCUMENT_CANDIDATE["pageTo"]
    assert evidence[0].retrieval_score == VALID_DOCUMENT_CANDIDATE["retrievalScore"]


@pytest.mark.parametrize("page_from,page_to", [(2, 3), (3, 3)])
def test_candidate_mapping_preserves_ordered_pages(page_from, page_to):
    """Valid retrieval pages remain unchanged in Evidence and JSON."""
    candidate = {**VALID_DOCUMENT_CANDIDATE, "pageFrom": page_from, "pageTo": page_to}
    evidence = RetrievalMapper.to_domain({"successful": True, "data": {"candidates": [candidate]}})[0]

    assert (evidence.page_from, evidence.page_to) == (page_from, page_to)
    serialized = json.loads(json.dumps(evidence.to_dict()))
    assert (serialized["pageFrom"], serialized["pageTo"]) == (page_from, page_to)


@pytest.mark.parametrize("candidate,page_from_field,page_to_field", [
    (VALID_DOCUMENT_CANDIDATE, "pageFrom", "pageTo"),
    (VALID_SNAKE_CANDIDATE, "page_from", "page_to"),
])
def test_candidate_mapping_rejects_inverted_page_range(candidate, page_from_field, page_to_field):
    """Chat's citation contract requires an ordered range; no page is silently changed."""
    candidate = {**candidate, page_from_field: 3, page_to_field: 2}
    with pytest.raises(RetrievalInvalidResponseException) as exc_info:
        RetrievalMapper.to_domain({"successful": True, "data": {"candidates": [candidate]}})

    assert exc_info.value.status_code == 502
    assert exc_info.value.details == {}


@pytest.mark.parametrize("document_version", [1, 9007199254740993, 10**400])
def test_candidate_mapping_preserves_integer_version(document_version):
    """Document versions retain exact integer values without float conversion."""
    candidate = {**VALID_DOCUMENT_CANDIDATE, "documentVersion": document_version}
    evidence = RetrievalMapper.to_domain({"successful": True, "data": {"candidates": [candidate]}})[0]

    assert evidence.document_version == document_version
    assert json.loads(json.dumps(evidence.to_dict()))["documentVersion"] == document_version


def test_candidate_mapping_preserves_large_page_numbers():
    """Large valid page integers remain exact from candidate through serialization."""
    large_page = 9007199254740993
    candidate = {**VALID_DOCUMENT_CANDIDATE, "pageFrom": large_page, "pageTo": large_page + 1}
    evidence = RetrievalMapper.to_domain({"successful": True, "data": {"candidates": [candidate]}})[0]

    assert evidence.page_from == large_page
    assert evidence.page_to == large_page + 1
    assert json.loads(json.dumps(evidence.to_dict()))["pageTo"] == large_page + 1
    assert f"Pages {large_page}-{large_page + 1}" in ContextBuilder.build_context([evidence])


@pytest.mark.parametrize("missing_field", tuple(VALID_SNAKE_CANDIDATE))
def test_candidate_mapping_rejects_missing_required_snake_field(missing_field):
    """The existing snake-case retrieval candidate also needs all contract fields."""
    candidate = dict(VALID_SNAKE_CANDIDATE)
    candidate.pop(missing_field)

    with pytest.raises(RetrievalInvalidResponseException):
        RetrievalMapper.to_domain({"successful": True, "data": {"candidates": [candidate]}})


@pytest.mark.parametrize("invalid_source", [None, "other", 7])
def test_candidate_mapping_rejects_invalid_snake_source_type(invalid_source):
    """Source type must use the enum from the existing retrieval draft."""
    candidate = {**VALID_SNAKE_CANDIDATE, "source_type": invalid_source}

    with pytest.raises(RetrievalInvalidResponseException):
        RetrievalMapper.to_domain({"successful": True, "data": {"candidates": [candidate]}})


@pytest.mark.parametrize(
    "payload",
    [
        {"successful": True, "data": {"candidates": None}},
        {"successful": True, "data": {"candidates": [None]}},
        {"successful": True, "data": {"candidates": [{}]}},
        {"successful": True, "data": {}},
        {"candidates": []},
        {},
        None,
    ],
)
def test_candidate_mapping_rejects_malformed_payload(payload):
    """Malformed retrieval success data is technical failure, never no evidence."""
    with pytest.raises(RetrievalInvalidResponseException):
        RetrievalMapper.to_domain(payload)


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
        assert exc_info.value.status_code == 503
        assert "Index is rebuilding" not in str(exc_info.value)
        assert exc_info.value.details == {}

