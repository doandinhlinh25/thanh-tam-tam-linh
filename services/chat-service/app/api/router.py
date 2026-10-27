"""Central API router aggregating all controller endpoints."""
from fastapi import APIRouter
from app.api.controllers.health_controller import router as health_router
from app.api.controllers.chat_controller import router as chat_router
from app.api.controllers.conversation_controller import router as conversation_router
from app.api.controllers.feedback_controller import router as feedback_router
from app.api.controllers.llm_controller import router as llm_router

api_router = APIRouter()

# Health endpoints at /health
api_router.include_router(health_router, prefix="/health", tags=["Health"])

# Internal LLM inference endpoints at /internal/llm/generate
api_router.include_router(llm_router)

# Public v1 API endpoints (/api/v1/...)
v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(chat_router, tags=["Chat"])
v1_router.include_router(conversation_router, prefix="/conversations", tags=["Conversations"])
v1_router.include_router(feedback_router, tags=["Feedback"])

api_router.include_router(v1_router)
