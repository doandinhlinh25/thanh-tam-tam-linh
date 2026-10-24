"""Evidence gate ensuring retrieved chunks satisfy relevance threshold."""
from typing import List, Any


class EvidenceGate:
    """Evaluates and filters retrieved evidence against minimum confidence thresholds."""

    def __init__(self, min_confidence: float = 0.65):
        self.min_confidence = min_confidence

    def _extract_score(self, ev: Any) -> float:
        """Extract score from Evidence object or dict."""
        if isinstance(ev, dict):
            raw = (
                ev.get("retrievalScore")
                if "retrievalScore" in ev
                else ev.get("retrieval_score")
                if "retrieval_score" in ev
                else ev.get("score", 0.0)
            )
            try:
                return float(raw) if raw is not None else 0.0
            except (ValueError, TypeError):
                return 0.0
        score = getattr(ev, "retrieval_score", None)
        if score is None:
            score = getattr(ev, "retrievalScore", None)
        if score is None:
            score = getattr(ev, "score", 0.0)
        try:
            return float(score) if score is not None else 0.0
        except (ValueError, TypeError):
            return 0.0

    def evaluate(self, evidence_list: list) -> bool:
        """Return True if sufficient evidence exists to answer safely."""
        if not evidence_list:
            return False
        return any(ev is not None and self._extract_score(ev) >= self.min_confidence for ev in evidence_list)

    def filter_evidence(self, evidence_list: list) -> list:
        """Filter and return only evidence chunks meeting or exceeding the confidence threshold."""
        if not evidence_list:
            return []
        return [ev for ev in evidence_list if ev is not None and self._extract_score(ev) >= self.min_confidence]
