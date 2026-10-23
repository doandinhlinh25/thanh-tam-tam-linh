"""Validates inline citations against provided source chunks."""
import re
import uuid
from typing import List, Any
from app.domain.value_objects.citation import ChatCitation
from app.domain.exceptions import CitationVerificationFailedException


class CitationValidator:
    """Extracts inline citations, verifies candidate mapping, and builds ChatCitation objects."""

    BRACKET_PATTERNS = [
        re.compile(r"\[([^\]]+)\](?!\()"),
        re.compile(r"［([^］]+)］"),
        re.compile(r"【([^】]+)】"),
    ]
    PREFIX_PAREN_PATTERN = re.compile(
        r"\(((?:source|src|doc|document|tài liệu|nguồn|ref(?:erence)?|trích dẫn|no\.?|#)\s*[:.]?\s*[^)]+)\)",
        re.IGNORECASE,
    )
    NUMERIC_PAREN_PATTERN = re.compile(
        r"\(([0-9ivxIVX]+(?:[-–—,;to\s]+[0-9ivxIVX]+)*)\)"
    )
    CITATION_PATTERNS = BRACKET_PATTERNS + [PREFIX_PAREN_PATTERN, NUMERIC_PAREN_PATTERN]
    CITATION_PATTERN = BRACKET_PATTERNS[0]
    ROMAN_NUMERALS = {
        "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5,
        "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10,
        "xi": 11, "xii": 12, "xiii": 13, "xiv": 14, "xv": 15,
        "xvi": 16, "xvii": 17, "xviii": 18, "xix": 19, "xx": 20,
    }

    @staticmethod
    def _is_numbered_list_item(token: str, before: str, after: str) -> bool:
        """Distinguish numbered list enumeration markers from parenthesized citations."""
        if any(sep in token for sep in [",", ";", "-", "–", "—"]) or "to" in token.lower():
            return False
        # If followed by whitespace + uppercase letter e.g. "(1) Nộp...", "(2) Chờ..."
        if re.match(r"^\s+[A-ZÀ-Ỹ]", after):
            # And preceded by start of string/line, colon, semicolon, dash, or list comma
            if re.search(r"(?:^|\n)\s*$", before) or re.search(r"[:;\-–—]\s*$", before) or re.search(r",\s*$", before):
                return True
        return False

    def _parse_token(self, token: str) -> List[int]:
        """Parse an individual citation token into one or more integer indices."""
        token = token.strip()
        if not token:
            return []

        # Strip common citation prefixes e.g. "Source 1", "Doc 1", "Tài liệu 1", "Nguồn 1", "#1"
        token = re.sub(
            r"^(?:source|src|document|doc|tài liệu|nguồn|ref(?:erence)?|trích dẫn|no\.?|#)\s*[:.]?\s*",
            "",
            token,
            flags=re.IGNORECASE,
        ).strip()
        if not token:
            return []

        # Check for range: e.g. "1-3", "1 - 3", "1–3", "1—3", "1 to 3"
        range_parts = re.split(r"\s*(?:[-–—]|\bto\b)\s*", token)
        if len(range_parts) == 2:
            s_raw, e_raw = range_parts[0].strip(), range_parts[1].strip()
            s_val = int(s_raw) if s_raw.isdigit() else self.ROMAN_NUMERALS.get(s_raw.lower())
            e_val = int(e_raw) if e_raw.isdigit() else self.ROMAN_NUMERALS.get(e_raw.lower())
            if s_val is not None and e_val is not None:
                if s_val <= e_val and (e_val - s_val <= 50):
                    return list(range(s_val, e_val + 1))
                elif s_val > e_val and (s_val - e_val <= 50):
                    return list(range(s_val, e_val - 1, -1))

        if token.isdigit():
            return [int(token)]

        if token.lower() in self.ROMAN_NUMERALS:
            return [self.ROMAN_NUMERALS[token.lower()]]

        return []

    def extract_citation_indices(self, answer: str) -> List[int]:
        """Extract unique 1-based citation indices from answer preserving order of appearance."""
        if not answer:
            return []
        indices: List[int] = []

        def _add_from_token(raw_token: str) -> None:
            subtokens = re.split(r"[,;]", raw_token)
            for sub in subtokens:
                vals = self._parse_token(sub)
                for val in vals:
                    if val not in indices:
                        indices.append(val)

        # 1. Standard, Asian, and fullwidth brackets
        for pattern in self.BRACKET_PATTERNS:
            for match in pattern.findall(answer):
                _add_from_token(match)

        # 2. Parentheses with explicit citation prefixes (e.g. (Source 1), (#1), (Doc 2))
        for match in self.PREFIX_PAREN_PATTERN.findall(answer):
            _add_from_token(match)

        # 3. Pure numeric/compound/range parentheses (e.g. (1), (1, 2), (1-3), nội dung(1)nội dung)
        for m in self.NUMERIC_PAREN_PATTERN.finditer(answer):
            token = m.group(1)
            before = answer[: m.start()]
            after = answer[m.end() :]
            if self._is_numbered_list_item(token, before, after):
                continue
            _add_from_token(token)

        return indices

    def validate_citations(self, answer: str, evidence_list: list) -> bool:
        """Verify that inline citations exist and every citation maps to an actual candidate in evidence_list."""
        indices = self.extract_citation_indices(answer)
        if not indices:
            return False
        total_candidates = len(evidence_list)
        if total_candidates == 0:
            return False
        return all(1 <= idx <= total_candidates and evidence_list[idx - 1] is not None for idx in indices)

    def validate(self, answer: str, evidence_list: list) -> bool:
        """Alias for validate_citations."""
        return self.validate_citations(answer, evidence_list)

    def build_citations(self, answer: str, evidence_list: list) -> List[ChatCitation]:
        """Build ChatCitation objects for each cited candidate in the evidence snapshot."""
        indices = self.extract_citation_indices(answer)
        total_candidates = len(evidence_list)
        citations: List[ChatCitation] = []

        for idx in indices:
            if not (1 <= idx <= total_candidates):
                raise CitationVerificationFailedException(
                    f"Inline citation [{idx}] does not map to any candidate in evidence snapshot (total: {total_candidates})"
                )
            ev = evidence_list[idx - 1]
            citation_id = f"cit-{uuid.uuid4().hex[:8]}"
            if isinstance(ev, dict):
                evidence_id = str(ev.get("evidenceId") or ev.get("evidence_id") or str(idx))
                raw_stype = str(ev.get("source_type") or ev.get("sourceType") or "official").lower()
                source_type = "personal" if raw_stype == "personal" else "official"
                document_id = str(ev.get("documentId") or ev.get("document_id") or "")
                document_name = str(ev.get("documentName") or ev.get("document_name") or ev.get("source_title") or "")
                raw_pfrom = ev.get("pageFrom") or ev.get("page_from") or ev.get("page_number") or 1
                try:
                    page_from = max(1, int(float(raw_pfrom)))
                except (ValueError, TypeError):
                    page_from = 1
                raw_pto = ev.get("pageTo") or ev.get("page_to") or page_from
                try:
                    page_to = max(page_from, int(float(raw_pto)))
                except (ValueError, TypeError):
                    page_to = page_from
                text = str(ev.get("text") or ev.get("content") or "")
            else:
                evidence_id = str(getattr(ev, "evidence_id", getattr(ev, "evidenceId", str(idx))))
                raw_stype = str(getattr(ev, "source_type", getattr(ev, "sourceType", "official"))).lower()
                source_type = "personal" if raw_stype == "personal" else "official"
                document_id = str(getattr(ev, "document_id", getattr(ev, "documentId", "")))
                document_name = str(getattr(ev, "document_name", getattr(ev, "documentName", getattr(ev, "source_title", ""))))
                raw_pfrom = getattr(ev, "page_from", getattr(ev, "pageFrom", getattr(ev, "page_number", 1)))
                try:
                    page_from = max(1, int(float(raw_pfrom)))
                except (ValueError, TypeError):
                    page_from = 1
                raw_pto = getattr(ev, "page_to", getattr(ev, "pageTo", page_from))
                try:
                    page_to = max(page_from, int(float(raw_pto)))
                except (ValueError, TypeError):
                    page_to = page_from
                text = str(getattr(ev, "text", getattr(ev, "content", "")))

            # Conform strictly to minLength: 1 for snippet in contracts/openapi/chat.yaml
            if text and text.strip():
                snippet = text.strip()[:200]
            elif document_name and document_name.strip():
                snippet = document_name.strip()
            else:
                snippet = f"Tài liệu {evidence_id}"

            citations.append(
                ChatCitation(
                    citation_id=citation_id,
                    evidence_id=evidence_id,
                    source_type=source_type,
                    document_id=document_id,
                    document_name=document_name,
                    page_from=page_from,
                    page_to=page_to,
                    snippet=snippet,
                )
            )

        return citations
