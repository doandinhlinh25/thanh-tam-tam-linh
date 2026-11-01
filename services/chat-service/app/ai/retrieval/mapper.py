"""Maps retrieval API responses to domain Evidence value objects."""
import math
from typing import List, Any
from app.domain.value_objects.evidence import Evidence
from app.integrations.retrieval_service.exceptions import (
    RETRIEVAL_INVALID_RESPONSE_MESSAGE,
    RetrievalInvalidResponseException,
)


DOCUMENT_EVIDENCE_ID_FIELD = "evidenceId"
RETRIEVAL_EVIDENCE_ID_FIELD = "evidence_id"
CANDIDATE_TEXT_FIELD = "text"
DOCUMENT_STRING_FIELDS = (
    DOCUMENT_EVIDENCE_ID_FIELD, "chunkId", "documentId", "documentName", CANDIDATE_TEXT_FIELD
)
DOCUMENT_INTEGER_FIELDS = ("documentVersion", "pageFrom", "pageTo")
DOCUMENT_PAGE_FROM_FIELD = "pageFrom"
DOCUMENT_PAGE_TO_FIELD = "pageTo"
DOCUMENT_SCORE_FIELD = "retrievalScore"
RETRIEVAL_STRING_FIELDS = (
    RETRIEVAL_EVIDENCE_ID_FIELD, "chunk_id", "document_id", "document_name", CANDIDATE_TEXT_FIELD
)
RETRIEVAL_INTEGER_FIELDS = ("document_version", "page_from", "page_to")
RETRIEVAL_PAGE_FROM_FIELD = "page_from"
RETRIEVAL_PAGE_TO_FIELD = "page_to"
RETRIEVAL_SCORE_FIELD = "retrieval_score"
RETRIEVAL_SOURCE_TYPE_FIELD = "source_type"
RETRIEVAL_SOURCE_TYPES = frozenset(("official", "personal"))
MIN_POSITIVE_INTEGER = 1


class RetrievalMapper:
    """Transforms raw search candidates or envelopes into domain Evidence objects."""

    @staticmethod
    def _is_valid_candidate(candidate: Any) -> bool:
        """Check all required fields in the selected existing candidate contract.

        :param candidate: One untrusted candidate from a retrieval response.
        :returns: True only when required types and contract bounds are valid.
        """
        if not isinstance(candidate, dict):
            return False
        if DOCUMENT_EVIDENCE_ID_FIELD in candidate:
            string_fields = DOCUMENT_STRING_FIELDS
            integer_fields = DOCUMENT_INTEGER_FIELDS
            score_field = DOCUMENT_SCORE_FIELD
            page_from_field = DOCUMENT_PAGE_FROM_FIELD
            page_to_field = DOCUMENT_PAGE_TO_FIELD
        elif RETRIEVAL_EVIDENCE_ID_FIELD in candidate:
            string_fields = RETRIEVAL_STRING_FIELDS
            integer_fields = RETRIEVAL_INTEGER_FIELDS
            score_field = RETRIEVAL_SCORE_FIELD
            page_from_field = RETRIEVAL_PAGE_FROM_FIELD
            page_to_field = RETRIEVAL_PAGE_TO_FIELD
            if candidate.get(RETRIEVAL_SOURCE_TYPE_FIELD) not in RETRIEVAL_SOURCE_TYPES:
                return False
            if not candidate.get(CANDIDATE_TEXT_FIELD):
                return False
        else:
            return False

        if not all(isinstance(candidate.get(field), str) for field in string_fields):
            return False
        if not all(
            type(candidate.get(field)) is int and candidate[field] >= MIN_POSITIVE_INTEGER
            for field in integer_fields
        ):
            return False
        # ChatCitation's draft contract requires an ordered page range.
        if candidate[page_to_field] < candidate[page_from_field]:
            return False
        score = candidate.get(score_field)
        if type(score) not in (int, float):
            return False
        try:
            return math.isfinite(score)
        except OverflowError:
            return False

    @staticmethod
    def _to_evidence(candidate: dict[str, Any]) -> Evidence:
        """Build Evidence only from the fields validated for one contract shape.

        :param candidate: Candidate already checked by ``_is_valid_candidate``.
        :returns: Evidence using required upstream values without fallback fields.
        """
        fields = (
            DOCUMENT_STRING_FIELDS + DOCUMENT_INTEGER_FIELDS + (DOCUMENT_SCORE_FIELD,)
            if DOCUMENT_EVIDENCE_ID_FIELD in candidate
            else RETRIEVAL_STRING_FIELDS
            + RETRIEVAL_INTEGER_FIELDS
            + (RETRIEVAL_SCORE_FIELD, RETRIEVAL_SOURCE_TYPE_FIELD)
        )
        return Evidence.from_dict({field: candidate[field] for field in fields})

    @staticmethod
    def to_domain(
        payload: dict[str, Any],
    ) -> List[Evidence]:
        """Map a valid retrieval envelope and reject malformed evidence responses.

        :param payload: Successful retrieval envelope with a candidate list.
        :returns: Evidence candidates, including an empty list when validly empty.
        :raises RetrievalInvalidResponseException: The envelope or a candidate is malformed.
        """
        if not isinstance(payload, dict) or payload.get("successful") is not True:
            raise RetrievalInvalidResponseException(RETRIEVAL_INVALID_RESPONSE_MESSAGE)
        data = payload.get("data")
        if not isinstance(data, dict) or not isinstance(data.get("candidates"), list):
            raise RetrievalInvalidResponseException(RETRIEVAL_INVALID_RESPONSE_MESSAGE)
        raw_candidates = data["candidates"]
        if not all(RetrievalMapper._is_valid_candidate(candidate) for candidate in raw_candidates):
            raise RetrievalInvalidResponseException(RETRIEVAL_INVALID_RESPONSE_MESSAGE)

        return [RetrievalMapper._to_evidence(candidate) for candidate in raw_candidates]
