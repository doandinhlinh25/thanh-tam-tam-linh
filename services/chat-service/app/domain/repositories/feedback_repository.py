"""Feedback repository interface."""
from abc import ABC, abstractmethod
from typing import Optional
from app.domain.entities.feedback import Feedback


class IFeedbackRepository(ABC):
    @abstractmethod
    async def save(self, feedback: Feedback) -> None:
        """Create or update feedback for an assistant message."""
        pass

    @abstractmethod
    async def get_by_message_id(self, message_id: str) -> Optional[Feedback]:
        """Fetch feedback for a message."""
        pass

    @abstractmethod
    async def get_by_message_and_user(self, message_id: str, user_id: str) -> Optional[Feedback]:
        """Fetch existing feedback for a specific message and user."""
        pass

    @abstractmethod
    async def delete_by_conversation(self, conversation_id: str) -> int:
        """Delete feedback associated with messages of a conversation."""
        pass
