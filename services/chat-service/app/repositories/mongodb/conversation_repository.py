"""MongoDB implementation of conversation persistence."""
from datetime import UTC, datetime
from typing import Any

from app.core.pagination import bson_datetime, decode_cursor
from app.domain.entities.conversation import Conversation


class MongoConversationRepository:
    def __init__(self, uow: Any):
        self.uow = uow
        self.collection = uow.database["conversations"]

    def _entity(self, d: dict) -> Conversation:
        return Conversation(
            id=d["_id"], tenant_id=d["tenantId"], user_id=d["ownerUserId"],
            course_id=d.get("courseId"), title=d.get("title"),
            source_scope=d.get("sourceScope", "course_only"),
            created_at=d["createdAt"], updated_at=d["updatedAt"],
            last_message_at=d.get("lastMessageAt"), is_deleted=d.get("status") == "deleted",
        )

    async def get_by_id(self, conversation_id: str, tenant_id: str, user_id: str) -> Conversation | None:
        self._validate_scope(tenant_id, user_id)
        query = {"_id": conversation_id, "tenantId": tenant_id, "status": "active"}
        query["ownerUserId"] = user_id
        d = await self.collection.find_one(query, **self.uow.session_option())
        return self._entity(d) if d else None

    @staticmethod
    def _validate_scope(tenant_id: str, user_id: str) -> None:
        if not tenant_id or not user_id:
            raise ValueError("Conversation access requires tenant_id and user_id")

    async def fence_feedback_write(self, conversation_id: str, tenant_id: str, user_id: str) -> bool:
        """Write the aggregate parent to serialize feedback with hard deletion."""
        self._validate_scope(tenant_id, user_id)
        session = await self.uow.ensure_transaction()
        result = await self.collection.update_one(
            {"_id": conversation_id, "tenantId": tenant_id, "ownerUserId": user_id, "status": "active"},
            {"$inc": {"feedbackFence": 1}},
            session=session,
        )
        return result.modified_count == 1

    async def list_by_user(self, user_id: str, tenant_id: str, course_id: str | None = None,
                           source_scope: str | None = None, limit: int = 20,
                           cursor: str | None = None) -> list[Conversation]:
        query: dict = {"tenantId": tenant_id, "ownerUserId": user_id, "status": "active"}
        if course_id is not None:
            query["courseId"] = course_id
        if source_scope is not None:
            query["sourceScope"] = source_scope
        decoded = decode_cursor(cursor)
        if decoded:
            query["$or"] = ([{"createdAt": {"$lt": decoded.created_at}},
                             {"createdAt": decoded.created_at, "_id": {"$lt": decoded.identifier}}]
                            if decoded.identifier else [{"createdAt": {"$lt": decoded.created_at}}])
        cur = self.collection.find(query, **self.uow.session_option()).sort([("createdAt", -1), ("_id", -1)]).limit(limit)
        return [self._entity(d) async for d in cur]

    async def save(self, conversation: Conversation) -> None:
        session = await self.uow.ensure_transaction()
        now = bson_datetime(datetime.now(UTC))
        doc = {"_id": conversation.id, "tenantId": conversation.tenant_id,
               "ownerUserId": conversation.user_id, "courseId": conversation.course_id,
               "sourceScope": getattr(conversation, "source_scope", "course_only"),
               "title": conversation.title, "status": "deleted" if conversation.is_deleted else "active",
               "createdAt": bson_datetime(conversation.created_at or now),
               "updatedAt": bson_datetime(conversation.updated_at or now),
               "lastMessageAt": bson_datetime(conversation.last_message_at) if conversation.last_message_at else None}
        existing = await self.collection.find_one({"_id": conversation.id}, session=session)
        if existing and (existing.get("tenantId") != conversation.tenant_id or existing.get("ownerUserId") != conversation.user_id):
            raise PermissionError("Conversation ownership conflict")
        doc["feedbackFence"] = existing.get("feedbackFence", 0) if existing else 0
        await self.collection.replace_one({"_id": conversation.id}, doc, upsert=True, session=session)

    async def delete(self, conversation_id: str, tenant_id: str, user_id: str,
                     hard_delete: bool = False) -> bool:
        self._validate_scope(tenant_id, user_id)
        session = await self.uow.ensure_transaction()
        query = {"_id": conversation_id, "tenantId": tenant_id, "ownerUserId": user_id}
        if hard_delete:
            result = await self.collection.delete_one(query, session=session)
            return result.deleted_count == 1
        result = await self.collection.update_one({**query, "status": "active"},
            {"$set": {"status": "deleted", "updatedAt": bson_datetime(datetime.now(UTC))}}, session=session)
        return result.modified_count == 1
