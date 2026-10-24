"""Exceptions arising during Retrieval Service communication."""
from app.core.exceptions import AppBaseException


class RetrievalServiceException(AppBaseException):
    """Base exception for retrieval service interactions."""
    status_code = 500
    error_code = "RETRIEVAL_ERROR"


class RetrievalServiceUnavailableException(AppBaseException):
    status_code = 503
    error_code = "RETRIEVAL_SERVICE_UNAVAILABLE"


class RetrievalTimeoutException(AppBaseException):
    status_code = 504
    error_code = "RETRIEVAL_TIMEOUT"


class RetrievalClientException(AppBaseException):
    status_code = 400
    error_code = "RETRIEVAL_CLIENT_ERROR"
