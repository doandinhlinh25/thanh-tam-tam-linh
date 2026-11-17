"""Security helpers and tenant authentication token validation."""


def verify_session_token(token: str) -> dict | None:
    """Validate user session cookie / bearer token."""
    raise NotImplementedError
