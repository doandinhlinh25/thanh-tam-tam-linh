"""Validates LLM answer against hallucination / boundary rules."""

class AnswerValidator:
    def validate(self, answer: str, context: str) -> bool:
        raise NotImplementedError
