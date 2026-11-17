"""Idempotently create Chat Service collections and MongoDB indexes."""
import asyncio

from pymongo import ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid

from app.integrations.database.session import close_database, get_database

INDEXES = {
    "conversations": [
        ([('tenantId', ASCENDING), ('ownerUserId', ASCENDING), ('status', ASCENDING), ('createdAt', DESCENDING), ('_id', DESCENDING)], "conversation_owner_page"),
        ([('tenantId', ASCENDING), ('ownerUserId', ASCENDING), ('status', ASCENDING), ('courseId', ASCENDING), ('sourceScope', ASCENDING), ('createdAt', DESCENDING), ('_id', DESCENDING)], "conversation_filtered_page"),
    ],
    "messages": [([('tenantId', ASCENDING), ('ownerUserId', ASCENDING), ('conversationId', ASCENDING), ('createdAt', ASCENDING), ('_id', ASCENDING)], "message_history_page")],
    "citation_snapshots": [
        ([('tenantId', ASCENDING), ('messageId', ASCENDING)], "citation_message"),
        ([('tenantId', ASCENDING), ('messageId', ASCENDING), ('citationId', ASCENDING)], "citation_natural_key", True),
        ([('tenantId', ASCENDING), ('ownerUserId', ASCENDING), ('messageId', ASCENDING)], "citation_owner_message"),
    ],
    "feedback": [
        ([('tenantId', ASCENDING), ('messageId', ASCENDING), ('userId', ASCENDING)], "feedback_message_user", True),
        ([('tenantId', ASCENDING), ('ownerUserId', ASCENDING), ('conversationId', ASCENDING)], "feedback_conversation_owner"),
    ],
    "model_usage": [([('tenantId', ASCENDING), ('requestId', ASCENDING)], "usage_request", True)],
    "outbox_events": [([('eventId', ASCENDING)], "outbox_event", True)],
}


async def ensure_indexes(db) -> None:
    for name, indexes in INDEXES.items():
        if name not in await db.list_collection_names():
            try:
                await db.create_collection(name)
            except CollectionInvalid:
                # A concurrent bootstrap may have created it.
                pass
        collection = db[name]
        for spec in indexes:
            keys, index_name, *unique = spec
            await collection.create_index(keys, name=index_name, unique=bool(unique and unique[0]))


async def migrate() -> None:
    db = await get_database()
    await ensure_indexes(db)


async def main() -> None:
    try:
        await migrate()
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())
