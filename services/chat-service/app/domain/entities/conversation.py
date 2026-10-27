"""Conversation domain entity."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from app.domain.entities.message import Message


@dataclass
class Conversation:
    id: str
    tenant_id: str
    user_id: str
    course_id: Optional[str]
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: List[Message] = field(default_factory=list)
    source_scope: str = "course_only"
    last_message_at: Optional[datetime] = None
    is_deleted: bool = False
