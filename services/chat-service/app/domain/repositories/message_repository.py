"""Message repository interface."""
from abc import ABC, abstractmethod

from app.domain.entities.message import Message


class IMessageRepository(ABC):
    @abstractmethod
    async def get_by_id(self, message_id: str, tenant_id: str, owner_user_id: str) -> Message | None:
        """Fetch message by ID."""

    @abstractmethod
    async def list_by_conversation(
        self,
        conversation_id: str,
        tenant_id: str,
        owner_user_id: str,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[Message]:
        """List chronological messages for a conversation."""

    @abstractmethod
    async def save(self, message: Message) -> None:
        """Persist message with serialized citations and status/refusal metadata."""

    @abstractmethod
    async def delete_by_conversation(self, conversation_id: str, tenant_id: str, owner_user_id: str) -> int:
        """Delete all messages associated with a conversation."""
