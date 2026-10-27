"""Feedback domain entity."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Any, Union


@dataclass
class Feedback:
    id: str
    message_id: str
    user_id: str
    rating: Union[str, int]
    comment: Optional[str] = None
    reason: Optional[str] = None
    tenant_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
