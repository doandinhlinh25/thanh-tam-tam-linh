"""Feedback domain entity."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class Feedback:
    id: str
    message_id: str
    user_id: str
    rating: int
    comment: Optional[str]
    created_at: datetime
