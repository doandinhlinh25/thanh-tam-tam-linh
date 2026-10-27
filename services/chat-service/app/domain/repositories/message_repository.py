"""Message repository interface."""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.entities.message import Message


class IMessageRepository(ABC):
    @abstractmethod
    async def get_by_id(self, message_id: str) -> Optional[Message]:
        """Fetch message by ID."""
        pass

    @abstractmethod
    async def list_by_conversation(
        self,
        conversation_id: str,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> List[Message]:
        """List chronological messages for a conversation."""
        pass

    @abstractmethod
    async def save(self, message: Message) -> None:
        """Persist message with serialized citations and status/refusal metadata."""
        pass

    @abstractmethod
    async def delete_by_conversation(self, conversation_id: str) -> int:
        """Delete all messages associated with a conversation."""
        pass
