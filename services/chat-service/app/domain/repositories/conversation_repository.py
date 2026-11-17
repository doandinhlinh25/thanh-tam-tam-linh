"""Conversation repository interface."""
from abc import ABC, abstractmethod

from app.domain.entities.conversation import Conversation


class IConversationRepository(ABC):
    @abstractmethod
    async def get_by_id(
        self,
        conversation_id: str,
        tenant_id: str,
        user_id: str,
    ) -> Conversation | None:
        """Fetch conversation by ID verifying tenant and owner isolation."""

    @abstractmethod
    async def list_by_user(
        self,
        user_id: str,
        tenant_id: str,
        course_id: str | None = None,
        source_scope: str | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> list[Conversation]:
        """List active conversations for a user with optional course filtering and pagination."""

    @abstractmethod
    async def save(self, conversation: Conversation) -> None:
        """Create or update a conversation entity."""

    @abstractmethod
    async def delete(
        self,
        conversation_id: str,
        tenant_id: str,
        user_id: str,
        hard_delete: bool = False,
    ) -> bool:
        """Soft or hard delete conversation owned by tenant and user."""
