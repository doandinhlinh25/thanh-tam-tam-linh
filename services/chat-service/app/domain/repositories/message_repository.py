"""Message repository interface."""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.entities.message import Message

class IMessageRepository(ABC):
    @abstractmethod
    async def get_by_id(self, message_id: str) -> Optional[Message]:
        pass

    @abstractmethod
    async def list_by_conversation(self, conversation_id: str) -> List[Message]:
        pass

    @abstractmethod
    async def save(self, message: Message) -> None:
        pass
