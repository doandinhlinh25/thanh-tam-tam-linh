"""Evidence gate ensuring retrieved chunks satisfy relevance threshold."""

class EvidenceGate:
    def __init__(self, min_confidence: float = 0.65):
        self.min_confidence = min_confidence

    def evaluate(self, evidence_list: list) -> bool:
        """Return True if sufficient evidence exists to answer safely."""
        if not evidence_list:
            return False
        return any(ev.score >= self.min_confidence for ev in evidence_list)
