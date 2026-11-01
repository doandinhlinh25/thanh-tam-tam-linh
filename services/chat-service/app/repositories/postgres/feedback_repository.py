"""PostgreSQL implementation of IFeedbackRepository."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.feedback import Feedback
from app.domain.repositories.feedback_repository import IFeedbackRepository
from app.repositories.models.feedback_model import FeedbackModel
from app.repositories.models.message_model import MessageModel


class PostgresFeedbackRepository(IFeedbackRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_entity(self, model: FeedbackModel) -> Feedback:
        return Feedback(
            id=model.id,
            message_id=model.message_id,
            user_id=model.user_id,
            rating=model.rating,
            comment=model.comment,
            reason=model.reason,
            tenant_id=model.tenant_id,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_message_id(self, message_id: str) -> Optional[Feedback]:
        query = select(FeedbackModel).where(FeedbackModel.message_id == message_id)
        res = await self.session.execute(query)
        model = res.scalar_one_or_none()
        if not model:
            return None
        return self._to_entity(model)

    async def get_by_message_and_user(self, message_id: str, user_id: str) -> Optional[Feedback]:
        query = select(FeedbackModel).where(
            FeedbackModel.message_id == message_id,
            FeedbackModel.user_id == user_id,
        )
        res = await self.session.execute(query)
        model = res.scalar_one_or_none()
        if not model:
            return None
        return self._to_entity(model)

    async def save(self, feedback: Feedback) -> None:
        model = None
        if feedback.user_id and feedback.message_id:
            query = select(FeedbackModel).where(
                FeedbackModel.message_id == feedback.message_id,
                FeedbackModel.user_id == feedback.user_id,
            )
            res = await self.session.execute(query)
            model = res.scalar_one_or_none()

        if not model and feedback.id:
            query = select(FeedbackModel).where(FeedbackModel.id == feedback.id)
            res = await self.session.execute(query)
            model = res.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        rating_str = str(feedback.rating)

        if model:
            model.rating = rating_str
            model.comment = feedback.comment
            model.reason = getattr(feedback, "reason", None)
            if getattr(feedback, "tenant_id", None):
                model.tenant_id = feedback.tenant_id
            model.updated_at = now
            feedback.id = model.id
            feedback.created_at = model.created_at
            await self.session.flush()
        else:
            fb_id = feedback.id or f"fb-{uuid.uuid4().hex[:12]}"
            feedback.id = fb_id
            created_at = feedback.created_at or now
            model = FeedbackModel(
                id=fb_id,
                message_id=feedback.message_id,
                user_id=feedback.user_id,
                tenant_id=getattr(feedback, "tenant_id", None),
                rating=rating_str,
                reason=getattr(feedback, "reason", None),
                comment=feedback.comment,
                created_at=created_at,
                updated_at=now,
            )
            try:
                async with self.session.begin_nested():
                    self.session.add(model)
                    await self.session.flush()
            except Exception as exc:
                # Concurrent insertion occurred, re-query and update
                query = select(FeedbackModel).where(
                    FeedbackModel.message_id == feedback.message_id,
                    FeedbackModel.user_id == feedback.user_id,
                )
                res = await self.session.execute(query)
                model = res.scalar_one_or_none()
                if model:
                    model.rating = rating_str
                    model.comment = feedback.comment
                    model.reason = getattr(feedback, "reason", None)
                    if getattr(feedback, "tenant_id", None):
                        model.tenant_id = feedback.tenant_id
                    model.updated_at = now
                    feedback.id = model.id
                    feedback.created_at = model.created_at
                    await self.session.flush()
                else:
                    raise exc

    async def delete_by_conversation(self, conversation_id: str) -> int:
        msg_query = select(MessageModel.id).where(MessageModel.conversation_id == conversation_id)
        stmt = delete(FeedbackModel).where(FeedbackModel.message_id.in_(msg_query))
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount or 0
