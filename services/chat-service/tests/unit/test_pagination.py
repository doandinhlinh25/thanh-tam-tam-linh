"""Cursor format compatibility and BSON timestamp precision tests."""
import base64
from datetime import UTC, datetime

from app.core.pagination import bson_datetime, decode_cursor, encode_cursor


def test_v2_cursor_round_trip_includes_string_tie_breaker():
    value = datetime(2026, 1, 2, 3, 4, 5, 123456, tzinfo=UTC)
    cursor = decode_cursor(encode_cursor(value, "msg-a"))
    assert cursor.created_at == datetime(2026, 1, 2, 3, 4, 5, 123000, tzinfo=UTC)
    assert cursor.identifier == "msg-a"


def test_legacy_base64_and_raw_timestamp_cursors_remain_accepted():
    value = "2026-01-02T03:04:05.123456+00:00"
    legacy = base64.b64encode(value.encode()).decode()
    assert decode_cursor(legacy).created_at == bson_datetime(datetime.fromisoformat(value))
    assert decode_cursor(value).identifier is None


def test_bson_datetime_rounds_down_to_millisecond_precision():
    value = datetime(2026, 1, 2, 3, 4, 5, 123999, tzinfo=UTC)
    assert bson_datetime(value).microsecond == 123000
