"""Re-export LLM controller router and dependencies for backwards compatibility."""
from app.api.controllers.llm_controller import (
    router,
    get_provider,
    request_id_from_header,
    resolve_request_id,
    generate,
    LLMServiceErrorWithStatus,
)

__all__ = [
    "router",
    "get_provider",
    "request_id_from_header",
    "resolve_request_id",
    "generate",
    "LLMServiceErrorWithStatus",
]

