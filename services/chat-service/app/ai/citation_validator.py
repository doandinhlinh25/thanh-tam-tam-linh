"""Validates inline citations against provided source chunks."""

class CitationValidator:
    def validate_citations(self, answer: str, citations: list) -> bool:
        raise NotImplementedError
