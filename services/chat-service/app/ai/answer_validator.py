"""Validates LLM answer against hallucination and boundary rules."""
import re
from typing import Set


class AnswerValidator:
    """Ensures LLM answer adheres to boundary rules and does not hallucinate facts outside evidence."""

    REFUSAL_INDICATORS = [
        "xin lỗi",
        "không chứa đủ thông tin",
        "không đủ thông tin",
        "không tìm thấy thông tin",
        "không có thông tin",
        "không đề cập",
        "tài liệu không chứa",
        "tôi không thể trả lời",
        "tôi không biết",
        "chưa có thông tin",
        "rất tiếc",
    ]

    INJECTION_OR_LEAK_PATTERNS = [
        re.compile(r"bạn là trợ lý ai chuyên", re.IGNORECASE),
        re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
        re.compile(r"system\s+prompt", re.IGNORECASE),
        re.compile(r"dưới đây là ngữ cảnh từ các tài liệu", re.IGNORECASE),
        re.compile(r"reveal\s+(secret|hidden|system)", re.IGNORECASE),
    ]

    STOPWORDS: Set[str] = {
        "là", "và", "của", "có", "trong", "được", "cho", "với", "các", "những",
        "này", "đó", "một", "theo", "về", "đến", "từ", "khi", "như", "đã", "sẽ",
        "thì", "mà", "nếu", "bởi", "vì", "ra", "vào", "lại", "cũng",
        "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to",
        "for", "of", "and", "or", "by", "with", "from",
    }

    CONTEXT_HEADER_WORDS: Set[str] = {"source", "content", "page", "pages", "unknown"}

    def validate(self, answer: str, context: str) -> bool:
        """Validate that the answer satisfies boundary rules and context faithfulness."""
        if not answer or not answer.strip():
            return False

        stripped_answer = answer.strip()
        lower_answer = stripped_answer.lower()

        # 1. Polite refusal messages always satisfy boundary rules
        if any(ind in lower_answer for ind in self.REFUSAL_INDICATORS):
            return True

        # 2. Check for system prompt leaks or prompt injections
        for pattern in self.INJECTION_OR_LEAK_PATTERNS:
            if pattern.search(stripped_answer):
                return False

        # 3. If context is empty and answer is not a refusal, it is hallucinated
        if not context or not context.strip():
            return False

        # 4. Check factual grounding (overlap with context)
        # Strip all inline citation markers (standard [...], Asian 【...】, ［...］, and parenthesized (...))
        clean_text = lower_answer
        clean_text = re.sub(r"[\[【［][^\]】］]+[\]】］]", "", clean_text)
        clean_text = re.sub(
            r"\((?:source|src|doc|document|tài liệu|nguồn|ref(?:erence)?|trích dẫn|no\.?|#)\s*[:.]?\s*[^)]+\)",
            "",
            clean_text,
            flags=re.IGNORECASE,
        )
        clean_text = re.sub(r"\(([0-9ivx\s,;–—\-to]+)\)", "", clean_text, flags=re.IGNORECASE)
        words = re.findall(r"\b\w{2,}\b", clean_text)
        substantive_words = [w for w in words if w not in self.STOPWORDS]

        if not substantive_words:
            # If answer contains no substantive words (e.g. only numbers/punctuation)
            return True

        lower_context = context.lower()
        context_words = set(re.findall(r"\b\w{2,}\b", lower_context)) - self.CONTEXT_HEADER_WORDS
        matched = sum(1 for w in substantive_words if w in context_words)
        overlap_ratio = matched / len(substantive_words)

        # Disjoint answer (0% overlap with context) indicates hallucination
        if overlap_ratio == 0.0:
            return False

        return True
