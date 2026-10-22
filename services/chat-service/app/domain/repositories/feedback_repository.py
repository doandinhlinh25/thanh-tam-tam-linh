"""Feedback repository interface."""
from abc import ABC, abstractmethod
from typing import Optional
from app.domain.entities.feedback import Feedback

class IFeedbackRepository(ABC):
    @abstractmethod
    async def save(self, feedback: Feedback) -> None:
        pass

    @abstractmethod
    async def get_by_message_id(self, message_id: str) -> Optional[Feedback]:
        pass
