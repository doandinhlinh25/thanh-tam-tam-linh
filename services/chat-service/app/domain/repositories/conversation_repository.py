"""Conversation repository interface."""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.entities.conversation import Conversation


class IConversationRepository(ABC):
    @abstractmethod
    async def get_by_id(
        self,
        conversation_id: str,
        tenant_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Conversation]:
        """Fetch conversation by ID verifying tenant and optional owner user isolation."""
        pass

    @abstractmethod
    async def list_by_user(
        self,
        user_id: str,
        tenant_id: str,
        course_id: Optional[str] = None,
        source_scope: Optional[str] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> List[Conversation]:
        """List active conversations for a user with optional course filtering and pagination."""
        pass

    @abstractmethod
    async def save(self, conversation: Conversation) -> None:
        """Create or update a conversation entity."""
        pass

    @abstractmethod
    async def delete(
        self,
        conversation_id: str,
        tenant_id: str,
        user_id: Optional[str] = None,
        hard_delete: bool = False,
    ) -> bool:
        """Soft or hard delete conversation owned by tenant and user."""
        pass
