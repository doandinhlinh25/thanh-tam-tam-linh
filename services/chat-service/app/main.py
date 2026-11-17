"""Main FastAPI application entry point for Chat Service."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.error_handlers import register_error_handlers
from app.api.middleware.request_id import RequestIdMiddleware
from app.api.middleware.request_logging import RequestLoggingMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.integrations.database.session import close_database, initialize_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    await initialize_database()
    try:
        yield
    finally:
        await close_database()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
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
