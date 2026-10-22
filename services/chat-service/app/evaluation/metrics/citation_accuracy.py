"""Citation Accuracy metric: evaluates correctness of inline citations."""

class CitationAccuracyMetric:
    async def compute(self, answer: str, citations: list, evidence: list) -> float:
        raise NotImplementedError
