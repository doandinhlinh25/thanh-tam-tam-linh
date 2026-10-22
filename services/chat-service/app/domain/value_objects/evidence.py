"""Evidence chunk value object retrieved from RAG knowledge store."""
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class Evidence:
    chunk_id: str
    document_id: str
    source_title: str
    content: str
    score: float
    page_number: Optional[int] = None
