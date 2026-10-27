"""Message domain entity."""
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Any, Union
from app.domain.enums.message_role import MessageRole


@dataclass
class Message:
    id: str
    conversation_id: str
    role: Union[MessageRole, str]
    content: str
    created_at: datetime
    refused: bool = False
    refusal_reason: Optional[str] = None
    citations: Optional[List[Any]] = None
    status: Optional[str] = None
