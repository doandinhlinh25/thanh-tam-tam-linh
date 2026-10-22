"""Maps retrieval API responses to domain Evidence value objects."""
from typing import List
from app.domain.value_objects.evidence import Evidence
from app.ai.retrieval.schemas import RetrievedChunkSchema

class RetrievalMapper:
    @staticmethod
    def to_domain(chunks: List[RetrievedChunkSchema]) -> List[Evidence]:
        return [
            Evidence(
                chunk_id=c.chunk_id,
                document_id=c.document_id,
                source_title=c.source_title,
                content=c.content,
                score=c.score,
                page_number=c.page_number,
            )
            for c in chunks
        ]
