"""Conversation controller for managing user chat history."""
from fastapi import APIRouter
from typing import List
from app.schemas.conversation.response import ConversationSummaryResponse

router = APIRouter()

@router.get("", response_model=List[ConversationSummaryResponse])
async def list_conversations():
    """List user conversations."""
    raise NotImplementedError
