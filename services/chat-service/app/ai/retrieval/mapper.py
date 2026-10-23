"""Maps retrieval API responses to domain Evidence value objects."""
from typing import List, Union, Any
from app.domain.value_objects.evidence import Evidence
from app.ai.retrieval.schemas import RetrievedChunkSchema


class RetrievalMapper:
    """Transforms raw search candidates or envelopes into domain Evidence objects."""

    @staticmethod
    def to_domain(
        payload: Union[List[Any], dict[str, Any]],
    ) -> List[Evidence]:
        """Convert candidates list or success envelope into domain Evidence objects."""
        raw_candidates: List[Any] = []

        if isinstance(payload, dict):
            # Handle Document Service SearchResponse: {successful: True, data: {candidates: [...]}}
            data = payload.get("data", payload)
            if isinstance(data, dict):
                raw_candidates = data.get("candidates") or []
            elif isinstance(data, list):
                raw_candidates = data
            else:
                raw_candidates = payload.get("candidates") or payload.get("chunks") or []
        elif isinstance(payload, list):
            raw_candidates = payload
        else:
            return []

        raw_candidates = [c for c in (raw_candidates or []) if c is not None]

        results: List[Evidence] = []
        for item in raw_candidates:
            if isinstance(item, Evidence):
                results.append(item)
            elif isinstance(item, RetrievedChunkSchema):
                results.append(
                    Evidence(
                        evidence_id=item.chunk_id,
                        chunk_id=item.chunk_id,
                        document_id=item.document_id,
                        document_name=item.source_title,
                        document_version=1,
                        page_from=item.page_number or 1,
                        page_to=item.page_number or 1,
                        text=item.content,
                        retrieval_score=item.score,
                    )
                )
            elif isinstance(item, dict):
                results.append(Evidence.from_dict(item))
            elif hasattr(item, "__dict__"):
                results.append(Evidence.from_dict(vars(item)))

        return results
