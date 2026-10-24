"""Refusal policy returning standard courteous answers when evidence is missing."""

class RefusalPolicy:
    STANDARD_REFUSAL_MESSAGE = (
        "Xin lỗi, tài liệu khóa học và tài liệu được cấp quyền không chứa đủ "
        "thông tin để trả lời câu hỏi của bạn một cách chính xác."
    )

    @classmethod
    def get_refusal(cls, reason: str = "insufficient_evidence") -> str:
        return cls.STANDARD_REFUSAL_MESSAGE
