"""Tenant-scoped, idempotent MongoDB feedback writes."""
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.pagination import bson_datetime
from app.domain.entities.feedback import Feedback


class MongoFeedbackRepository:
    def __init__(self, uow: Any):
        self.uow = uow
        self.collection = uow.database["feedback"]

    def _entity(self, d: dict) -> Feedback:
        return Feedback(id=d["_id"], message_id=d["messageId"], user_id=d["userId"],
            rating=d["rating"], comment=d.get("comment"), reason=d.get("reason"),
            tenant_id=d["tenantId"], created_at=d["createdAt"], updated_at=d.get("updatedAt"))

    async def get_by_message_id(self, message_id: str, tenant_id: str, owner_user_id: str) -> Feedback | None:
        d = await self.collection.find_one({"messageId": message_id, "tenantId": tenant_id,
            "ownerUserId": owner_user_id}, **self.uow.session_option())
        return self._entity(d) if d else None

    async def get_by_message_and_user(self, message_id: str, user_id: str, tenant_id: str) -> Feedback | None:
        d = await self.collection.find_one({"messageId": message_id, "userId": user_id,
            "tenantId": tenant_id, "ownerUserId": user_id}, **self.uow.session_option())
        return self._entity(d) if d else None

    async def save(self, feedback: Feedback) -> None:
        tenant_id = feedback.tenant_id
        owner_user_id = feedback.user_id
        if not tenant_id or not owner_user_id or not feedback.message_id:
            raise ValueError("Feedback requires tenant, owner, and message scope")
        now = bson_datetime(datetime.now(UTC))
        created = bson_datetime(feedback.created_at or now)
        natural = {"tenantId": tenant_id, "messageId": feedback.message_id,
                   "userId": feedback.user_id, "ownerUserId": owner_user_id}
        values: dict = {"rating": str(feedback.rating), "updatedAt": now}
        if feedback.comment is not None:
            values["comment"] = feedback.comment
        if feedback.reason is not None:
            values["reason"] = feedback.reason
        candidate_id = feedback.id or f"fb-{uuid4().hex[:12]}"
        for attempt in range(3):
            session = await self.uow.ensure_transaction()
            try:
                parent = await self.uow.database["messages"].find_one({"_id": feedback.message_id,
                    "tenantId": tenant_id, "ownerUserId": owner_user_id, "role": "assistant"}, session=session)
                if not parent:
                    raise LookupError("Assistant message not found in tenant/owner scope")
                conversation_id = parent["conversationId"]
                if not await self.uow.conversations.fence_feedback_write(
                    conversation_id, tenant_id, owner_user_id
                ):
                    raise LookupError("Active parent conversation not found in tenant/owner scope")
                insert: dict = {"_id": candidate_id, **natural,
                                "conversationId": conversation_id, "createdAt": created}
                if feedback.comment is None:
                    insert["comment"] = None
                if feedback.reason is None:
                    insert["reason"] = None
                result = await self.collection.update_one(natural, {"$set": values, "$setOnInsert": insert},
                    upsert=True, session=session)
                if result.upserted_id is not None:
                    feedback.id = str(result.upserted_id)
                    feedback.created_at = created
                else:
                    existing = await self.collection.find_one(natural, session=session)
                    feedback.id = existing["_id"]
                    feedback.created_at = existing["createdAt"]
                break
            except DuplicateKeyError:
                await self.uow.rollback()
                session = await self.uow.ensure_transaction()
                try:
                    parent = await self.uow.database["messages"].find_one({"_id": feedback.message_id,
                        "tenantId": tenant_id, "ownerUserId": owner_user_id, "role": "assistant"}, session=session)
                    if not parent:
                        raise LookupError("Assistant message not found in tenant/owner scope")
                    if not await self.uow.conversations.fence_feedback_write(
                        parent["conversationId"], tenant_id, owner_user_id
                    ):
                        raise LookupError("Active parent conversation not found in tenant/owner scope")
                    existing = await self.collection.find_one({"tenantId": tenant_id,
                        "messageId": feedback.message_id, "userId": feedback.user_id,
                        "ownerUserId": owner_user_id}, session=session)
                    if existing is None:
                        raise
                    await self.collection.update_one({**natural, "_id": existing["_id"]},
                        {"$set": values}, upsert=False, session=session)
                    feedback.id = existing["_id"]
                    feedback.created_at = existing["createdAt"]
                    break
                except PyMongoError as exc:
                    retryable = bool(getattr(exc, "has_error_label", lambda _: False)("TransientTransactionError"))
                    await self.uow.rollback()
                    if not retryable or attempt == 2:
                        raise
                except Exception:
                    await self.uow.rollback()
                    raise
            except PyMongoError as exc:
                retryable = bool(getattr(exc, "has_error_label", lambda _: False)("TransientTransactionError"))
                await self.uow.rollback()
                if not retryable or attempt == 2:
                    raise
        else:
            raise RuntimeError("Feedback transaction retry limit exhausted")
        feedback.updated_at = now

    async def delete_by_conversation(self, conversation_id: str, tenant_id: str, owner_user_id: str) -> int:
        session = await self.uow.ensure_transaction()
        result = await self.collection.delete_many({"conversationId": conversation_id,
            "tenantId": tenant_id, "ownerUserId": owner_user_id}, session=session)
        return result.deleted_count
