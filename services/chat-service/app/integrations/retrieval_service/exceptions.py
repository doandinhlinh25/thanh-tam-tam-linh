"""Exceptions arising during Retrieval Service communication."""
from app.core.exceptions import AppBaseException

class RetrievalServiceUnavailableException(AppBaseException):
    status_code = 503
    error_code = "RETRIEVAL_SERVICE_UNAVAILABLE"

class RetrievalTimeoutException(AppBaseException):
    status_code = 504
    error_code = "RETRIEVAL_TIMEOUT"
