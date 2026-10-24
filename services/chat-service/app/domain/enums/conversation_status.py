"""Conversation lifecycle status enumeration."""
from enum import Enum

class ConversationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"
