"""Chat controller handling RAG QA endpoints."""
from fastapi import APIRouter, Header
from typing import Optional
from app.schemas.chat.request import CourseChatRequest
from app.schemas.chat.response import ChatResponse

router = APIRouter()

@router.post("/courses/{course_id}/chat", response_model=ChatResponse)
async def ask_course_chat(
    course_id: str,
    payload: CourseChatRequest,
    x_request_id: Optional[str] = Header(None),
):
    """Ask a question using authorized course and personal documents."""
    raise NotImplementedError
