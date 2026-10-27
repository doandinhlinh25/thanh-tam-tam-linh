"""Feedback service for storing and analyzing user feedback."""
import uuid
from datetime import datetime, timezone
from typing import Optional, Union, Dict, Any
from app.core.exceptions import NotFoundException, ValidationException
from app.domain.entities.feedback import Feedback
from app.domain.repositories.feedback_repository import IFeedbackRepository
from app.domain.repositories.message_repository import IMessageRepository
from app.integrations.database.unit_of_work import UnitOfWork


class FeedbackService:
    def __init__(
        self,
        feedback_repo: IFeedbackRepository,
        message_repo: Optional[IMessageRepository] = None,
        uow: Optional[UnitOfWork] = None,
    ):
        self.feedback_repo = feedback_repo or (uow.feedbacks if uow else None)
        self.message_repo = message_repo or (uow.messages if uow else None)
        self.uow = uow

    async def submit_feedback(
        self,
        message_id: str,
        user_id: str,
        rating: Union[str, int],
        comment: Optional[str] = None,
        tenant_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record or update user feedback for an assistant message."""
        # 1. Verify message exists and is an assistant message
        if self.message_repo:
            msg = await self.message_repo.get_by_id(message_id)
            if not msg:
                raise NotFoundException(f"Message {message_id} not found")
            role_str = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
            if role_str != "assistant":
                raise ValidationException("Feedback can only be submitted for assistant messages")

        # 2. Validate rating
        if isinstance(rating, bool):
            rating_str = "positive" if rating else "negative"
        elif isinstance(rating, int):
            rating_str = "positive" if rating >= 3 else "negative"
        else:
            rating_str = str(rating).lower().strip()
            if rating_str not in ("positive", "negative"):
                raise ValidationException("Rating must be 'positive' or 'negative'")

        if comment and len(comment) > 2000:
            raise ValidationException("Comment cannot exceed 2000 characters")

        # 3. Check for existing feedback from this user for this message
        existing = await self.feedback_repo.get_by_message_and_user(message_id, user_id)
        now = datetime.now(timezone.utc)

        if existing:
            fb = Feedback(
                id=existing.id,
                message_id=message_id,
                user_id=user_id,
                tenant_id=tenant_id or existing.tenant_id,
                rating=rating_str,
                comment=comment if comment is not None else existing.comment,
                reason=reason if reason is not None else existing.reason,
                created_at=existing.created_at or now,
                updated_at=now,
            )
        else:
            fb_id = f"fb-{uuid.uuid4().hex[:12]}"
            fb = Feedback(
                id=fb_id,
                message_id=message_id,
                user_id=user_id,
                tenant_id=tenant_id,
                rating=rating_str,
                comment=comment,
                reason=reason,
                created_at=now,
                updated_at=now,
            )

        try:
            await self.feedback_repo.save(fb)

            if self.uow:
                await self.uow.commit()
        except Exception:
            if self.uow:
                await self.uow.rollback()
            raise

        return {
            "successful": True,
            "data": {
                "feedback_id": fb.id,
                "message_id": message_id,
                "rating": rating_str,
                "created_at": fb.created_at,
            },
            "error": None,
        }
