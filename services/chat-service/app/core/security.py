"""Security helpers and tenant authentication token validation."""
from typing import Optional

def verify_session_token(token: str) -> Optional[dict]:
    """Validate user session cookie / bearer token."""
    raise NotImplementedError
