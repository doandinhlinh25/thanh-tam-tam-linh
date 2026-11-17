"""Core exceptions hierarchy."""


class AppBaseException(Exception):
    status_code: int = 500
    error_code: str = "INTERNAL_SERVER_ERROR"

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

class NotFoundException(AppBaseException):
    status_code = 404
    error_code = "NOT_FOUND"

class UnauthorizedException(AppBaseException):
    status_code = 401
    error_code = "UNAUTHORIZED"

class ForbiddenException(AppBaseException):
    status_code = 403
    error_code = "FORBIDDEN"

class ValidationException(AppBaseException):
    status_code = 400
    error_code = "VALIDATION_ERROR"

class ConflictException(AppBaseException):
    status_code = 409
    error_code = "CONFLICT"
