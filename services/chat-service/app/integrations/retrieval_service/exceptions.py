"""Exceptions arising during Retrieval Service communication."""
from app.core.exceptions import AppBaseException


RETRIEVAL_ERROR_MESSAGE = "Retrieval service error"
RETRIEVAL_UNAVAILABLE_MESSAGE = "Retrieval service unavailable"
RETRIEVAL_TIMEOUT_MESSAGE = "Retrieval service timeout"
RETRIEVAL_CLIENT_ERROR_MESSAGE = "Retrieval request rejected"
RETRIEVAL_FORBIDDEN_MESSAGE = "Retrieval access denied"
RETRIEVAL_RATE_LIMIT_MESSAGE = "Retrieval rate limit exceeded"
RETRIEVAL_INVALID_RESPONSE_MESSAGE = "Retrieval service returned an invalid response"


class RetrievalServiceException(AppBaseException):
    """Represent a technical retrieval failure without exposing upstream data."""
    status_code = 500
    error_code = "RETRIEVAL_ERROR"


class RetrievalServiceUnavailableException(AppBaseException):
    """Represent an unavailable retrieval dependency."""

    status_code = 503
    error_code = "RETRIEVAL_SERVICE_UNAVAILABLE"


class RetrievalTimeoutException(AppBaseException):
    """Represent a retrieval dependency timeout."""

    status_code = 504
    error_code = "RETRIEVAL_TIMEOUT"


class RetrievalClientException(AppBaseException):
    """Represent a rejected retrieval request."""

    status_code = 400
    error_code = "RETRIEVAL_CLIENT_ERROR"


class RetrievalForbiddenException(AppBaseException):
    """Represent a retrieval upstream authorization rejection."""

    status_code = 403
    error_code = "RETRIEVAL_FORBIDDEN"


class RetrievalRateLimitException(AppBaseException):
    """Represent retrieval upstream throttling."""

    status_code = 429
    error_code = "RETRIEVAL_RATE_LIMITED"


class RetrievalInvalidResponseException(AppBaseException):
    """Represent a malformed retrieval success response as a technical failure."""

    status_code = 502
    error_code = "RETRIEVAL_INVALID_RESPONSE"
