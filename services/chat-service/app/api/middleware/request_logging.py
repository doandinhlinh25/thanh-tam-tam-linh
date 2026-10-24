"""Middleware for logging structured HTTP request/response metrics."""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.logging import logger

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        logger.info(
            f"method={request.method} path={request.url.path} "
            f"status={response.status_code} duration={process_time:.4f}s"
        )
        return response
