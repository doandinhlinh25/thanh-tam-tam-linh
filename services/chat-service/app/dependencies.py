"""Common FastAPI dependency injection providers."""
from fastapi import Request

from app.integrations.database.session import get_db_session
from app.integrations.tenant_authorization.client import TenantAuthorizationClient
from app.integrations.tenant_authorization.errors import dependency_unavailable


async def get_session():
    async for session in get_db_session():
        yield session


def get_tenant_authorization_client(request: Request) -> TenantAuthorizationClient:
    """Resolve the app-scoped Tenant client for request handlers.

    :param request: Current FastAPI request with its initialized application state.
    :returns: The client created by the active app lifespan.
    :raises ChatAuthorizationError: If startup did not initialize auth integration.
    """
    client = getattr(request.app.state, "tenant_authorization_client", None)
    if client is None:
        raise dependency_unavailable()
    return client
