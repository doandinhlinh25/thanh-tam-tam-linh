"""Feedback domain entity."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Feedback:
    id: str
    message_id: str
    user_id: str
    rating: str | int
    comment: str | None = None
    reason: str | None = None
    tenant_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
