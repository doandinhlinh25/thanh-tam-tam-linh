"""MongoDB client lifecycle and database access."""
from datetime import UTC
from typing import Any

from bson.codec_options import CodecOptions
from pymongo import AsyncMongoClient

from app.core.config import settings

_client: AsyncMongoClient | None = None
_database: Any | None = None


async def initialize_database() -> Any:
    """Connect to the configured MongoDB and verify the deployment is reachable."""
    global _client, _database
    if _client is not None and _database is not None:
        await _client.admin.command("ping")
        return _database

    client = AsyncMongoClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=5_000,
    )
    try:
        await client.admin.command("ping")
    except Exception:
        await client.close()
        raise

    _client = client
    _database = client.get_database(
        settings.MONGODB_DATABASE,
        codec_options=CodecOptions(tz_aware=True, tzinfo=UTC),
    )
    return _database


async def get_database() -> Any:
    """Return the process database handle, connecting or raising on failure."""
    if _database is None:
        return await initialize_database()
    return _database


def get_client() -> AsyncMongoClient:
    """Return the active Mongo client for request-scoped sessions."""
    if _client is None:
        raise RuntimeError("MongoDB client has not been initialized")
    return _client


async def close_database() -> None:
    """Close the process client and clear its references."""
    global _client, _database
    client = _client
    _client = None
    _database = None
    if client is not None:
        await client.close()


# Kept as a small compatibility name for code/tests that explicitly initialize
# the service database; this no longer creates tables or falls back to SQLite.
async def ensure_db_initialized() -> Any:
    return await initialize_database()
