"""PostgreSQL implementation of IMessageRepository."""
import base64
from datetime import datetime, timezone
from typing import List, Optional, Any
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationException
from app.domain.entities.message import Message
from app.domain.repositories.message_repository import IMessageRepository
from app.domain.value_objects.citation import ChatCitation
from app.repositories.models.message_model import MessageModel


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


class PostgresMessageRepository(IMessageRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _serialize_citations(self, citations: Optional[List[Any]]) -> Optional[List[dict]]:
        if not citations:
            return None
        serialized = []
        for c in citations:
            if hasattr(c, "to_dict"):
                serialized.append(c.to_dict())
            elif hasattr(c, "model_dump"):
                serialized.append(c.model_dump())
            elif isinstance(c, dict):
                serialized.append(c)
            elif hasattr(c, "__dict__"):
                serialized.append(c.__dict__)
            else:
                serialized.append(dict(c))
        return serialized

    def _deserialize_citations(self, raw: Optional[List[dict]]) -> List[ChatCitation]:
        if not raw:
            return []
        citations = []
        for d in raw:
            if isinstance(d, ChatCitation):
                citations.append(d)
                continue
            if not isinstance(d, dict):
                continue
            ev_id = d.get("evidence_id") or d.get("chunk_id") or d.get("evidenceId") or ""
            cit = ChatCitation(
                citation_id=d.get("citation_id") or d.get("citationId") or f"cit-{ev_id or '0'}",
                evidence_id=ev_id,
                source_type=d.get("source_type") or d.get("sourceType") or "official",
                document_id=d.get("document_id") or d.get("documentId") or "",
                document_name=d.get("document_name") or d.get("title") or d.get("documentName") or "",
                page_from=d.get("page_from") or d.get("page_number") or d.get("pageFrom") or 1,
                page_to=d.get("page_to") or d.get("page_number") or d.get("pageTo") or 1,
                snippet=d.get("snippet") or "",
            )
            citations.append(cit)
        return citations

    def _to_entity(self, model: MessageModel) -> Message:
        return Message(
            id=model.id,
            conversation_id=model.conversation_id,
            role=model.role,
            content=model.content,
            created_at=model.created_at,
            refused=model.refused,
            refusal_reason=model.refusal_reason,
            citations=self._deserialize_citations(model.citations),
            status=model.status,
        )

    async def get_by_id(self, message_id: str) -> Optional[Message]:
        query = select(MessageModel).where(MessageModel.id == message_id)
        result = await self.session.execute(query)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._to_entity(model)

    async def list_by_conversation(
        self,
        conversation_id: str,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> List[Message]:
        query = select(MessageModel).where(MessageModel.conversation_id == conversation_id)
        cursor_dt = _parse_cursor(cursor) if cursor else None
        if cursor_dt:
            query = query.where(MessageModel.created_at > cursor_dt)

        query = query.order_by(MessageModel.created_at.asc())
        if limit:
            query = query.limit(limit)

        result = await self.session.execute(query)
        models = result.scalars().all()
        return [self._to_entity(m) for m in models]

    async def save(self, message: Message) -> None:
        query = select(MessageModel).where(MessageModel.id == message.id)
        res = await self.session.execute(query)
        model = res.scalar_one_or_none()

        serialized_citations = self._serialize_citations(message.citations)
        role_str = message.role.value if hasattr(message.role, "value") else str(message.role)
        now = datetime.now(timezone.utc)
        created_at = message.created_at or now

        if model:
            model.conversation_id = message.conversation_id
            model.role = role_str
            model.content = message.content
            model.status = getattr(message, "status", None)
            model.refused = message.refused
            model.refusal_reason = message.refusal_reason
            model.citations = serialized_citations
            if created_at:
                model.created_at = created_at
        else:
            model = MessageModel(
                id=message.id,
                conversation_id=message.conversation_id,
                role=role_str,
                content=message.content,
                status=getattr(message, "status", None),
                refused=message.refused,
                refusal_reason=message.refusal_reason,
                citations=serialized_citations,
                created_at=created_at,
            )
            self.session.add(model)
        await self.session.flush()

    async def delete_by_conversation(self, conversation_id: str) -> int:
        stmt = delete(MessageModel).where(MessageModel.conversation_id == conversation_id)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount or 0
