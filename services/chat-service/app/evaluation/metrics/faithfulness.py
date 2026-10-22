"""Faithfulness metric: evaluates whether the answer is grounded in context."""

class FaithfulnessMetric:
    async def compute(self, question: str, answer: str, context: str) -> float:
        raise NotImplementedError
