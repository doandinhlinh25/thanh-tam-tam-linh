"""Các lỗi nội bộ được ánh xạ thành response ổn định."""


class LLMServiceError(Exception):
    """Lỗi có mã và HTTP status an toàn để trả cho client."""

    code = "LLM_ERROR"
    status_code = 502
    message = "LLM request failed"


class RequestLimitError(LLMServiceError):
    code = "LLM_INVALID_REQUEST"
    status_code = 422
    message = "Request vượt quá giới hạn cấu hình"


class InvalidJSONOutputError(LLMServiceError):
    code = "LLM_INVALID_RESPONSE"
    status_code = 502
    message = "Nhà cung cấp trả về JSON object không hợp lệ"


class ProviderTimeoutError(LLMServiceError):
    code = "LLM_UPSTREAM_TIMEOUT"
    status_code = 504
    message = "Nhà cung cấp LLM đã hết thời gian phản hồi"


class ProviderRateLimitError(LLMServiceError):
    code = "LLM_PROVIDER_RATE_LIMITED"
    status_code = 503
    message = "Nhà cung cấp LLM đang giới hạn tốc độ"


class ProviderAuthError(LLMServiceError):
    code = "LLM_PROVIDER_AUTH_FAILED"
    status_code = 502
    message = "Xác thực với nhà cung cấp LLM thất bại"


class ProviderUnavailableError(LLMServiceError):
    code = "LLM_PROVIDER_UNAVAILABLE"
    status_code = 502
    message = "Nhà cung cấp LLM hiện không khả dụng"


class ProviderInvalidResponseError(LLMServiceError):
    code = "LLM_INVALID_RESPONSE"
    status_code = 502
    message = "Phản hồi từ nhà cung cấp LLM không hợp lệ"
