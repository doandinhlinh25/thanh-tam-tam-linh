"""PostgreSQL implementation of IConversationRepository."""
import base64
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationException
from app.domain.entities.conversation import Conversation
from app.domain.repositories.conversation_repository import IConversationRepository
from app.repositories.models.conversation_model import ConversationModel


def _parse_cursor(cursor_str: str) -> Optional[datetime]:
    if not cursor_str:
        return None
    try:
        dt = None
        try:
            decoded = base64.b64decode(cursor_str.encode()).decode()
            dt = datetime.fromisoformat(decoded)
        except Exception:
            pass
        if dt is None:
            dt = datetime.fromisoformat(cursor_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        raise ValidationException("Invalid pagination cursor")


class PostgresConversationRepository(IConversationRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_entity(self, model: ConversationModel) -> Conversation:
        return Conversation(
            id=model.id,
            tenant_id=model.tenant_id,
            user_id=model.user_id,
            course_id=model.course_id,
            title=model.title,
            source_scope=model.source_scope or "course_only",
            created_at=model.created_at,
            updated_at=model.updated_at,
            last_message_at=model.last_message_at,
            is_deleted=model.is_deleted,
        )

    async def get_by_id(
        self,
        conversation_id: str,
        tenant_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Conversation]:
        """Fetch conversation by ID verifying tenant and optional owner isolation."""
        query = select(ConversationModel).where(
            ConversationModel.id == conversation_id,
            ConversationModel.tenant_id == tenant_id,
            ConversationModel.is_deleted.is_(False),
        )
        if user_id is not None:
            query = query.where(ConversationModel.user_id == user_id)

        result = await self.session.execute(query)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._to_entity(model)

    async def list_by_user(
        self,
        user_id: str,
        tenant_id: str,
        course_id: Optional[str] = None,
        source_scope: Optional[str] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> List[Conversation]:
        """List active conversations for a user with course filtering and pagination."""
        query = select(ConversationModel).where(
            ConversationModel.tenant_id == tenant_id,
            ConversationModel.user_id == user_id,
            ConversationModel.is_deleted.is_(False),
        )
        if course_id is not None:
            query = query.where(ConversationModel.course_id == course_id)
        if source_scope is not None:
            query = query.where(ConversationModel.source_scope == source_scope)

        cursor_dt = _parse_cursor(cursor) if cursor else None
        if cursor_dt:
            query = query.where(ConversationModel.created_at < cursor_dt)

        query = query.order_by(ConversationModel.created_at.desc()).limit(limit)
        result = await self.session.execute(query)
        models = result.scalars().all()
        return [self._to_entity(m) for m in models]

    async def save(self, conversation: Conversation) -> None:
        """Create or update a conversation entity."""
        query = select(ConversationModel).where(ConversationModel.id == conversation.id)
        res = await self.session.execute(query)
        model = res.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        created_at = conversation.created_at or now
        updated_at = conversation.updated_at or now

        if model:
            model.tenant_id = conversation.tenant_id
            model.user_id = conversation.user_id
            model.course_id = conversation.course_id
            model.source_scope = getattr(conversation, "source_scope", "course_only")
            model.title = conversation.title
            model.updated_at = updated_at
            model.last_message_at = getattr(conversation, "last_message_at", None)
            model.is_deleted = getattr(conversation, "is_deleted", False)
        else:
            model = ConversationModel(
                id=conversation.id,
                tenant_id=conversation.tenant_id,
                user_id=conversation.user_id,
                course_id=conversation.course_id,
                source_scope=getattr(conversation, "source_scope", "course_only"),
                title=conversation.title,
                created_at=created_at,
                updated_at=updated_at,
                last_message_at=getattr(conversation, "last_message_at", None),
                is_deleted=getattr(conversation, "is_deleted", False),
            )
            self.session.add(model)
        await self.session.flush()

    async def delete(
        self,
        conversation_id: str,
        tenant_id: str,
        user_id: Optional[str] = None,
        hard_delete: bool = False,
    ) -> bool:
        """Delete conversation by ID ensuring owner validation."""
        query = select(ConversationModel).where(
            ConversationModel.id == conversation_id,
            ConversationModel.tenant_id == tenant_id,
        )
        if user_id is not None:
            query = query.where(ConversationModel.user_id == user_id)

        res = await self.session.execute(query)
        model = res.scalar_one_or_none()
        if not model:
            return False

        if hard_delete:
            await self.session.delete(model)
        else:
            if model.is_deleted:
                return False
            model.is_deleted = True
            model.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return True
