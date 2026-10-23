"""Citation value objects linking answer statements to source chunks."""
from dataclasses import dataclass
from typing import Optional, Any


@dataclass(frozen=True)
class Citation:
    document_id: str
    chunk_id: str
    title: str
    snippet: str
    page_number: Optional[int] = None


@dataclass(frozen=True)
class ChatCitation:
    """Domain ChatCitation linking inline answers to verified evidence candidates."""
    citation_id: str
    evidence_id: str
    source_type: str
    document_id: str
    document_name: str
    page_from: int
    page_to: int
    snippet: str

    @property
    def citationId(self) -> str:
        return self.citation_id

    @property
    def evidenceId(self) -> str:
        return self.evidence_id

    @property
    def sourceType(self) -> str:
        return self.source_type

    @property
    def documentId(self) -> str:
        return self.document_id

    @property
    def documentName(self) -> str:
        return self.document_name

    @property
    def pageFrom(self) -> int:
        return self.page_from

    @property
    def pageTo(self) -> int:
        return self.page_to

    def to_dict(self) -> dict[str, Any]:
        return {
            "citation_id": self.citation_id,
            "evidence_id": self.evidence_id,
            "source_type": self.source_type,
            "document_id": self.document_id,
            "document_name": self.document_name,
            "page_from": self.page_from,
            "page_to": self.page_to,
            "snippet": self.snippet,
        }
