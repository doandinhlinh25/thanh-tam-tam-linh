"""Message domain entity."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.domain.enums.message_role import MessageRole


@dataclass
class Message:
    id: str
    conversation_id: str
    role: MessageRole | str
    content: str
    created_at: datetime
    refused: bool = False
    refusal_reason: str | None = None
    citations: list[Any] | None = None
    status: str | None = None
