"""Answer Relevance metric: evaluates how directly the answer addresses the question."""

class AnswerRelevanceMetric:
    async def compute(self, question: str, answer: str) -> float:
        raise NotImplementedError
