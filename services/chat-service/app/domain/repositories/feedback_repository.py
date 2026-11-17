"""Feedback repository interface."""
from abc import ABC, abstractmethod

from app.domain.entities.feedback import Feedback


class IFeedbackRepository(ABC):
    @abstractmethod
    async def save(self, feedback: Feedback) -> None:
        """Create or update feedback for an assistant message."""

    @abstractmethod
    async def get_by_message_id(self, message_id: str, tenant_id: str, owner_user_id: str) -> Feedback | None:
        """Fetch feedback for a message."""

    @abstractmethod
    async def get_by_message_and_user(self, message_id: str, user_id: str, tenant_id: str) -> Feedback | None:
        """Fetch existing feedback for a specific message and user."""

    @abstractmethod
    async def delete_by_conversation(self, conversation_id: str, tenant_id: str, owner_user_id: str) -> int:
        """Delete feedback associated with messages of a conversation."""
