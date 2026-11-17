"""Conversation domain entity."""
from dataclasses import dataclass, field
from datetime import datetime

from app.domain.entities.message import Message


@dataclass
class Conversation:
    id: str
    tenant_id: str
    user_id: str
    course_id: str | None
    title: str | None
    created_at: datetime
    updated_at: datetime
    messages: list[Message] = field(default_factory=list)
    source_scope: str = "course_only"
    last_message_at: datetime | None = None
    is_deleted: bool = False
