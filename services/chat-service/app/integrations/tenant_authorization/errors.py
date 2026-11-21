"""Safe public error mapping for Tenant authorization dependency failures."""

from pydantic import ValidationError

from app.core.exceptions import AppBaseException
from app.integrations.tenant_authorization.schemas import (
    AuthorizationReason,
    FailureEnvelope,
)


class ChatAuthorizationError(AppBaseException):
    """An authorization or dependency error safe to return from the Chat API."""

    def __init__(self, status_code: int, error_code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


def invalid_dependency_response() -> ChatAuthorizationError:
    """Return a sanitized error for an invalid or unexpected Tenant response."""
    return ChatAuthorizationError(
        502,
        "AUTH_DEPENDENCY_INVALID_RESPONSE",
        "Dịch vụ xác thực trả về phản hồi không hợp lệ.",
    )


def dependency_unavailable() -> ChatAuthorizationError:
    """Return a sanitized error for a Tenant/Auth service configuration or outage."""
    return ChatAuthorizationError(
        503,
        "AUTH_DEPENDENCY_FAILURE",
        "Dịch vụ xác thực hiện không sẵn sàng.",
    )


def authorization_timeout() -> ChatAuthorizationError:
    """Return a sanitized error for a timed-out Tenant request."""
    return ChatAuthorizationError(
        504,
        "AUTH_DEPENDENCY_TIMEOUT",
        "Dịch vụ xác thực phản hồi quá thời gian cho phép.",
    )


def invalid_session() -> ChatAuthorizationError:
    """Return the only public 401 mapping: an invalid user session."""
    return ChatAuthorizationError(401, "SESSION_INVALID", "Vui lòng đăng nhập lại.")


def tenant_access_denied() -> ChatAuthorizationError:
    """Return a non-enumerating tenant membership denial."""
    return ChatAuthorizationError(403, "TENANT_ACCESS_DENIED", "Không có quyền truy cập tenant.")


def course_access_denied() -> ChatAuthorizationError:
    """Return a course permission denial."""
    return ChatAuthorizationError(403, "COURSE_ACCESS_DENIED", "Không có quyền truy cập khóa học.")


def csrf_invalid() -> ChatAuthorizationError:
    """Return a CSRF rejection without exposing token details."""
    return ChatAuthorizationError(403, "CSRF_INVALID", "CSRF token không hợp lệ.")


def origin_invalid() -> ChatAuthorizationError:
    """Return a local rejection for missing or disallowed browser Origin."""
    return ChatAuthorizationError(403, "ORIGIN_INVALID", "Origin không được phép.")


def validation_error() -> ChatAuthorizationError:
    """Return a safe 400 for invalid selector or ambiguous session cookie."""
    return ChatAuthorizationError(400, "VALIDATION_ERROR", "Request không hợp lệ.")


def map_upstream_failure(status_code: int, body: object) -> ChatAuthorizationError:
    """Map a status-consistent OpenAPI failure into the Chat public envelope.

    :param status_code: HTTP status returned by Tenant.
    :param body: Parsed JSON response body, or ``None`` when parsing failed.
    :returns: A safe Chat exception with the approved status and error code.
    """
    try:
        failure = FailureEnvelope.model_validate(body)
    except (ValidationError, TypeError, ValueError):
        return invalid_dependency_response()

    reason = failure.reasonCode
    if status_code == 400 and reason is None:
        return validation_error()
    if status_code == 401:
        if reason == AuthorizationReason.SESSION_INVALID:
            return invalid_session()
        if reason == AuthorizationReason.SERVICE_CREDENTIAL_INVALID:
            return dependency_unavailable()
        return invalid_dependency_response()
    if status_code == 403:
        if reason == AuthorizationReason.TENANT_ACCESS_DENIED:
            return tenant_access_denied()
        if reason == AuthorizationReason.COURSE_ACCESS_DENIED:
            return course_access_denied()
        if reason == AuthorizationReason.CSRF_INVALID:
            return csrf_invalid()
        return invalid_dependency_response()
    if status_code == 503:
        if reason in {
            AuthorizationReason.AUTH_SERVICE_CREDENTIAL_INVALID,
            AuthorizationReason.AUTH_SERVICE_UNAVAILABLE,
        }:
            return dependency_unavailable()
        if reason == AuthorizationReason.AUTH_RESPONSE_INVALID:
            return invalid_dependency_response()
        return invalid_dependency_response()
    if status_code >= 500:
        return dependency_unavailable()
    return invalid_dependency_response()
