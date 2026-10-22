"""Feedback controller for user rating/corrections on assistant answers."""
from fastapi import APIRouter
from app.schemas.feedback.request import FeedbackCreateRequest
from app.schemas.feedback.response import FeedbackResponse

router = APIRouter()

@router.post("", response_model=FeedbackResponse)
async def submit_feedback(payload: FeedbackCreateRequest):
    """Record user feedback for an assistant response message."""
    raise NotImplementedError
