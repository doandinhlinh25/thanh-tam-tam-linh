"""Stable cursor encoding with compatibility for timestamp-only cursors."""
import base64
import binascii
import json
from datetime import UTC, datetime
from typing import NamedTuple

from app.core.exceptions import ValidationException


class Cursor(NamedTuple):
    created_at: datetime
    identifier: str | None


def bson_datetime(value: datetime) -> datetime:
    """Normalize UTC and BSON's millisecond precision before persistence/cursor use."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)
    return value.replace(microsecond=(value.microsecond // 1000) * 1000)


def encode_cursor(created_at: datetime, identifier: str) -> str:
    value = {"v": 2, "createdAt": bson_datetime(created_at).isoformat(), "id": identifier}
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")


def decode_cursor(raw: str | None) -> Cursor | None:
    if not raw:
        return None
    try:
        decoded = None
        try:
            token = raw + "=" * (-len(raw) % 4)
            text = base64.urlsafe_b64decode(token.encode()).decode()
            try:
                payload = json.loads(text)
                if payload.get("v") == 2:
                    decoded = Cursor(bson_datetime(datetime.fromisoformat(payload["createdAt"])), str(payload["id"]))
            except (ValueError, TypeError, AttributeError, KeyError):
                decoded = Cursor(bson_datetime(datetime.fromisoformat(text)), None)
        except (ValueError, UnicodeDecodeError, binascii.Error):
            decoded = Cursor(bson_datetime(datetime.fromisoformat(raw)), None)
        if decoded is None:
            raise ValueError("Unsupported cursor")
        return decoded
    except (ValueError, TypeError, AttributeError, KeyError, UnicodeDecodeError, binascii.Error) as exc:
        raise ValidationException("Invalid pagination cursor") from exc
