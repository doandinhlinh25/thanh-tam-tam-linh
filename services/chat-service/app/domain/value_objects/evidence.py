"""Evidence chunk value object retrieved from RAG knowledge store."""
from typing import Optional, Any


class Evidence:
    """Domain Evidence value object representing retrieved knowledge chunks."""

    def __init__(
        self,
        evidence_id: Optional[str] = None,
        document_id: str = "",
        document_name: Optional[str] = None,
        document_version: Optional[int] = None,
        page_from: Optional[int] = None,
        page_to: Optional[int] = None,
        text: Optional[str] = None,
        retrieval_score: Optional[float] = None,
        chunk_id: Optional[str] = None,
        source_type: Optional[str] = None,
        # Alternate/camelCase kwargs for flexibility
        evidenceId: Optional[str] = None,
        documentId: Optional[str] = None,
        documentName: Optional[str] = None,
        documentVersion: Optional[int] = None,
        pageFrom: Optional[int] = None,
        pageTo: Optional[int] = None,
        retrievalScore: Optional[float] = None,
        chunkId: Optional[str] = None,
        source_title: Optional[str] = None,
        content: Optional[str] = None,
        score: Optional[float] = None,
        page_number: Optional[int] = None,
        **kwargs: Any,
    ):
        raw_eid = (
            evidenceId
            if evidenceId is not None
            else evidence_id
            if evidence_id is not None
            else chunkId
            if chunkId is not None
            else chunk_id
            if chunk_id is not None
            else ""
        )
        self._evidence_id = str(raw_eid)

        raw_did = documentId if documentId is not None else document_id
        self._document_id = str(raw_did or "")

        raw_dname = (
            documentName
            if documentName is not None
            else document_name
            if document_name is not None
            else source_title
            if source_title is not None
            else ""
        )
        self._document_name = str(raw_dname)

        raw_ver = documentVersion if documentVersion is not None else document_version
        try:
            self._document_version = max(1, int(float(raw_ver))) if raw_ver is not None else 1
        except (ValueError, TypeError):
            self._document_version = 1

        raw_pfrom = (
            pageFrom
            if pageFrom is not None
            else page_from
            if page_from is not None
            else page_number
            if page_number is not None
            else 1
        )
        try:
            self._page_from = max(1, int(float(raw_pfrom)))
        except (ValueError, TypeError):
            self._page_from = 1

        raw_pto = (
            pageTo
            if pageTo is not None
            else page_to
            if page_to is not None
            else self._page_from
        )
        try:
            self._page_to = max(self._page_from, int(float(raw_pto)))
        except (ValueError, TypeError):
            self._page_to = self._page_from

        raw_text = text if text is not None else content if content is not None else ""
        self._text = str(raw_text)

        raw_score = (
            retrievalScore
            if retrievalScore is not None
            else retrieval_score
            if retrieval_score is not None
            else score
            if score is not None
            else 0.0
        )
        try:
            self._retrieval_score = float(raw_score)
        except (ValueError, TypeError):
            self._retrieval_score = 0.0

        raw_cid = chunkId if chunkId is not None else chunk_id if chunk_id is not None else self._evidence_id
        self._chunk_id = str(raw_cid)

        raw_stype = source_type if source_type is not None else kwargs.get("sourceType", "official")
        self._source_type = str(raw_stype or "official")

    # Snake_case attributes
    @property
    def evidence_id(self) -> str:
        return self._evidence_id

    @property
    def document_id(self) -> str:
        return self._document_id

    @property
    def document_name(self) -> str:
        return self._document_name

    @property
    def document_version(self) -> int:
        return self._document_version

    @property
    def page_from(self) -> int:
        return self._page_from

    @property
    def page_to(self) -> int:
        return self._page_to

    @property
    def text(self) -> str:
        return self._text

    @property
    def retrieval_score(self) -> float:
        return self._retrieval_score

    @property
    def chunk_id(self) -> str:
        return self._chunk_id

    @property
    def source_type(self) -> str:
        return self._source_type

    # CamelCase properties conforming to Document Service contract
    @property
    def evidenceId(self) -> str:
        return self._evidence_id

    @property
    def documentId(self) -> str:
        return self._document_id

    @property
    def documentName(self) -> str:
        return self._document_name

    @property
    def documentVersion(self) -> int:
        return self._document_version

    @property
    def pageFrom(self) -> int:
        return self._page_from

    @property
    def pageTo(self) -> int:
        return self._page_to

    @property
    def retrievalScore(self) -> float:
        return self._retrieval_score

    @property
    def chunkId(self) -> str:
        return self._chunk_id

    # Legacy compatibility properties
    @property
    def score(self) -> float:
        return self._retrieval_score

    @property
    def content(self) -> str:
        return self._text

    @property
    def source_title(self) -> str:
        return self._document_name

    @property
    def page_number(self) -> Optional[int]:
        return self._page_from

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Evidence":
        return cls(**data)

    def to_dict(self) -> dict[str, Any]:
        return {
            "evidenceId": self.evidence_id,
            "chunkId": self.chunk_id,
            "documentId": self.document_id,
            "documentVersion": self.document_version,
            "documentName": self.document_name,
            "pageFrom": self.page_from,
            "pageTo": self.page_to,
            "text": self.text,
            "retrievalScore": self.retrieval_score,
            "sourceType": self.source_type,
        }

    def __repr__(self) -> str:
        return (
            f"Evidence(evidence_id='{self.evidence_id}', document_id='{self.document_id}', "
            f"document_name='{self.document_name}', document_version={self.document_version}, "
            f"page_from={self.page_from}, page_to={self.page_to}, "
            f"retrieval_score={self.retrieval_score})"
        )

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Evidence):
            return False
        return (
            self.evidence_id == other.evidence_id
            and self.document_id == other.document_id
            and self.document_name == other.document_name
            and self.document_version == other.document_version
            and self.page_from == other.page_from
            and self.page_to == other.page_to
            and self.text == other.text
            and abs(self.retrieval_score - other.retrieval_score) < 1e-6
        )

    def __hash__(self) -> int:
        return hash((self.evidence_id, self.document_id, self.document_version, self.page_from, self.page_to))
