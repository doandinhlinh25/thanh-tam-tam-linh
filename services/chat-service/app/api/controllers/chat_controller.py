"""Chat controller handling the existing course QA endpoint."""
from fastapi import APIRouter, Depends
from app.core.exceptions import UnauthorizedException
from app.schemas.chat.request import CourseChatRequest
from app.schemas.chat.response import ChatResponse
from app.services.chat_service import ChatService


CHAT_AUTH_UNAVAILABLE_MESSAGE = "Course chat authentication is unavailable"

router = APIRouter()

_chat_service = ChatService()


def get_chat_service() -> ChatService:
    """Return the chat service used by the course endpoint.

    :returns: The configured Chat service instance.
    """
    return _chat_service


@router.post("/courses/{course_id}/chat", response_model=ChatResponse)
async def ask_course_chat(
    course_id: str,
    payload: CourseChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    """Reject course chat until a trusted identity and course authorization exist.

    :param course_id: Course named in the existing route; it grants no access.
    :param payload: Validated question body; it grants no access.
    :param chat_service: Existing service dependency, never invoked here.
    :raises UnauthorizedException: Always, while trusted authentication is absent.
    """
    raise UnauthorizedException(CHAT_AUTH_UNAVAILABLE_MESSAGE)
