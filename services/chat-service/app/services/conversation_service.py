"""Conversation service handling thread lifecycle and message history."""
import base64
from typing import Optional, List, Dict, Any
from app.core.exceptions import NotFoundException
from app.domain.repositories.conversation_repository import IConversationRepository
from app.domain.repositories.message_repository import IMessageRepository
from app.domain.repositories.feedback_repository import IFeedbackRepository
from app.integrations.database.unit_of_work import UnitOfWork


def _get_attr_or_key(obj: Any, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if isinstance(obj, dict):
            if k in obj and obj[k] is not None:
                return obj[k]
        elif hasattr(obj, k):
            v = getattr(obj, k)
            if v is not None:
                return v
    return default


class ConversationService:
    def __init__(
        self,
        conversation_repo: IConversationRepository,
        message_repo: IMessageRepository,
        feedback_repo: Optional[IFeedbackRepository] = None,
        uow: Optional[UnitOfWork] = None,
    ):
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo
        self.feedback_repo = feedback_repo or (uow.feedbacks if uow else None)
        self.uow = uow

    async def list_conversations(
        self,
        tenant_id: str,
        user_id: str,
        course_id: Optional[str] = None,
        source_scope: Optional[str] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List conversations owned by authenticated user in active tenant."""
        if limit < 1:
            limit = 20
        fetch_limit = limit + 1
        items = await self.conversation_repo.list_by_user(
            user_id=user_id,
            tenant_id=tenant_id,
            course_id=course_id,
            source_scope=source_scope,
            limit=fetch_limit,
            cursor=cursor,
        )

        next_cursor = None
        if len(items) > limit:
            last_item = items[limit - 1]
            if last_item.created_at:
                iso_str = last_item.created_at.isoformat()
                next_cursor = base64.b64encode(iso_str.encode()).decode()
            items = items[:limit]

        result_items = [
            {
                "conversation_id": c.id,
                "course_id": c.course_id,
                "source_scope": getattr(c, "source_scope", "course_only"),
                "title": c.title,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
                "last_message_at": getattr(c, "last_message_at", None),
            }
            for c in items
        ]

        return {
            "successful": True,
            "data": {
                "items": result_items,
                "next_cursor": next_cursor,
            },
            "error": None,
        }

    async def get_conversation(
        self,
        tenant_id: str,
        user_id: str,
        conversation_id: str,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retrieve conversation detail and message history with owner access verification."""
        conv = await self.conversation_repo.get_by_id(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        if not conv:
            raise NotFoundException(f"Conversation {conversation_id} not found")

        if limit < 1:
            limit = 50
        fetch_limit = limit + 1
        messages = await self.message_repo.list_by_conversation(
            conversation_id=conversation_id,
            limit=fetch_limit,
            cursor=cursor,
        )

        next_cursor = None
        if len(messages) > limit:
            last_msg = messages[limit - 1]
            if last_msg.created_at:
                iso_str = last_msg.created_at.isoformat()
                next_cursor = base64.b64encode(iso_str.encode()).decode()
            messages = messages[:limit]

        formatted_messages = []
        for m in messages:
            citations = []
            if m.citations:
                for c in m.citations:
                    evidence_id = _get_attr_or_key(c, "evidence_id", "chunk_id", "evidenceId", default="")
                    doc_id = _get_attr_or_key(c, "document_id", "documentId", default="")
                    doc_name = _get_attr_or_key(c, "document_name", "title", "documentName", default="")
                    page_from = _get_attr_or_key(c, "page_from", "page_number", "pageFrom", default=1)
                    page_to = _get_attr_or_key(c, "page_to", "page_number", "pageTo", default=page_from)
                    cit_id = _get_attr_or_key(c, "citation_id", "citationId", default=f"cit-{evidence_id}")
                    src_type = _get_attr_or_key(c, "source_type", "sourceType", default="official")
                    snippet = _get_attr_or_key(c, "snippet", default="")
                    citations.append(
                        {
                            "citation_id": cit_id,
                            "evidence_id": evidence_id,
                            "source_type": src_type,
                            "document_id": doc_id,
                            "document_name": doc_name,
                            "page_from": page_from,
                            "page_to": page_to,
                            "snippet": snippet,
                        }
                    )

            role_str = m.role.value if hasattr(m.role, "value") else str(m.role)
            formatted_messages.append(
                {
                    "message_id": m.id,
                    "role": role_str,
                    "content": m.content,
                    "status": getattr(m, "status", None),
                    "citations": citations,
                    "created_at": m.created_at,
                }
            )

        return {
            "successful": True,
            "data": {
                "conversation_id": conv.id,
                "course_id": conv.course_id,
                "source_scope": getattr(conv, "source_scope", "course_only"),
                "title": conv.title,
                "messages": formatted_messages,
                "next_cursor": next_cursor,
                "created_at": conv.created_at,
                "updated_at": conv.updated_at,
            },
            "error": None,
        }

    async def delete_conversation(
        self,
        tenant_id: str,
        user_id: str,
        conversation_id: str,
    ) -> Dict[str, Any]:
        """Delete conversation and associated messages/feedback with owner verification."""
        conv = await self.conversation_repo.get_by_id(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        if not conv:
            raise NotFoundException(f"Conversation {conversation_id} not found")

        try:
            if self.feedback_repo:
                await self.feedback_repo.delete_by_conversation(conversation_id)

            await self.message_repo.delete_by_conversation(conversation_id)
            await self.conversation_repo.delete(
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                user_id=user_id,
                hard_delete=True,
            )

            if self.uow:
                await self.uow.commit()
        except Exception:
            if self.uow:
                await self.uow.rollback()
            raise

        return {
            "successful": True,
            "data": {
                "conversation_id": conversation_id,
                "deleted": True,
            },
            "error": None,
        }
