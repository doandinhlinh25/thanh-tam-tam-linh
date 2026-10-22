"""Message domain entity."""
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from app.domain.enums.message_role import MessageRole
from app.domain.value_objects.citation import Citation

@dataclass
class Message:
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    created_at: datetime
    refused: bool = False
    refusal_reason: Optional[str] = None
    citations: List[Citation] = None
