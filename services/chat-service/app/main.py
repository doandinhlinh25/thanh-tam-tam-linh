"""Main FastAPI application entry point for Chat Service."""
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.error_handlers import register_error_handlers
from app.api.middleware.request_id import RequestIdMiddleware
from app.api.middleware.request_logging import RequestLoggingMiddleware
from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.integrations.tenant_authorization.client import TenantAuthorizationClient


def create_app(settings_override: Settings | None = None) -> FastAPI:
    """Build the Chat application and its app-scoped Tenant client lifecycle.

    :param settings_override: Optional isolated settings object for tests.
    :returns: Configured FastAPI application.
    """
    app_settings = settings_override or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app_settings.validate_chat_authorization()
        async with httpx.AsyncClient(
            timeout=app_settings.TENANT_AUTHORIZATION_TIMEOUT_SECONDS,
            follow_redirects=False,
        ) as http_client:
            app.state.tenant_authorization_client = TenantAuthorizationClient(
                base_url=app_settings.TENANT_SERVICE_URL,
                service_token=app_settings.CHAT_SERVICE_TOKEN.get_secret_value(),
                http_client=http_client,
            )
            try:
                yield
            finally:
                app.state.tenant_authorization_client = None

    app = FastAPI(
        title=app_settings.APP_NAME,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )
    app.state.settings = app_settings
    if settings_override is not None:
        app.dependency_overrides[get_settings] = lambda: app_settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Tenant-Id", "X-CSRF-Token", "X-Request-ID"],
    )

    # Middleware
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(RequestLoggingMiddleware)

    # Error Handlers
    register_error_handlers(app)

    # Routers
    app.include_router(api_router)

    return app



app = create_app()
