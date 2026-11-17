"""MongoDB message history and citation snapshot persistence."""
from datetime import UTC, datetime
from typing import Any

from app.core.pagination import bson_datetime, decode_cursor
from app.domain.entities.message import Message
from app.domain.value_objects.citation import ChatCitation


class MongoMessageRepository:
    def __init__(self, uow: Any):
        self.uow = uow
        self.collection = uow.database["messages"]
        self.snapshots = uow.database["citation_snapshots"]

    def _citation(self, d: dict) -> ChatCitation:
        return ChatCitation(citation_id=d.get("citationId", ""), evidence_id=d.get("evidenceId", ""),
            source_type=d.get("sourceType", "official"), document_id=d.get("documentId", ""),
            document_name=d.get("documentName", ""), page_from=d.get("pageFrom", 1),
            page_to=d.get("pageTo", 1), snippet=d.get("snippet", ""))

    async def _entity(self, d: dict) -> Message:
        rows = self.snapshots.find({"tenantId": d["tenantId"], "ownerUserId": d["ownerUserId"],
            "messageId": d["_id"]}, **self.uow.session_option()).sort("ordinal", 1)
        citations = [self._citation(c) async for c in rows]
        return Message(id=d["_id"], conversation_id=d["conversationId"], role=d["role"],
            content=d["content"], created_at=d["createdAt"], refused=d.get("refused", False),
            refusal_reason=d.get("refusalReason"), citations=citations, status=d.get("resultState"))

    async def get_by_id(self, message_id: str, tenant_id: str, owner_user_id: str) -> Message | None:
        d = await self.collection.find_one({"_id": message_id, "tenantId": tenant_id,
            "ownerUserId": owner_user_id}, **self.uow.session_option())
        return await self._entity(d) if d else None

    async def list_by_conversation(self, conversation_id: str, tenant_id: str, owner_user_id: str,
                                   limit: int | None = None, cursor: str | None = None) -> list[Message]:
        query: dict = {"conversationId": conversation_id, "tenantId": tenant_id, "ownerUserId": owner_user_id}
        decoded = decode_cursor(cursor)
        if decoded:
            query["$or"] = ([{"createdAt": {"$gt": decoded.created_at}},
                             {"createdAt": decoded.created_at, "_id": {"$gt": decoded.identifier}}]
                            if decoded.identifier else [{"createdAt": {"$gt": decoded.created_at}}])
        cur = self.collection.find(query, **self.uow.session_option()).sort([("createdAt", 1), ("_id", 1)])
        if limit:
            cur = cur.limit(limit)
        result = []
        async for d in cur:
            result.append(await self._entity(d))
        return result

    async def save(self, message: Message) -> None:
        session = await self.uow.ensure_transaction()
        parent = await self.uow.database["conversations"].find_one({
            "_id": message.conversation_id, "status": "active"}, session=session)
        if not parent:
            raise LookupError("Active parent conversation not found")
        now = bson_datetime(datetime.now(UTC))
        created = bson_datetime(message.created_at or now)
        role = message.role.value if hasattr(message.role, "value") else str(message.role)
        doc = {"_id": message.id, "tenantId": parent["tenantId"], "ownerUserId": parent["ownerUserId"],
            "conversationId": message.conversation_id, "role": role, "content": message.content,
            "resultState": message.status, "requestId": None, "refused": message.refused,
            "refusalReason": message.refusal_reason, "createdAt": created}
        current = await self.collection.find_one({"_id": message.id}, session=session)
        if current and (current.get("tenantId") != doc["tenantId"] or current.get("ownerUserId") != doc["ownerUserId"]):
            raise PermissionError("Message ownership conflict")
        await self.collection.replace_one({"_id": message.id}, doc, upsert=True, session=session)
        await self.snapshots.delete_many({"tenantId": doc["tenantId"], "ownerUserId": doc["ownerUserId"],
            "messageId": message.id}, session=session)
        for ordinal, citation in enumerate(message.citations or []):
            if hasattr(citation, "to_dict"):
                c = citation.to_dict()
            elif isinstance(citation, dict):
                c = citation
            elif hasattr(citation, "model_dump"):
                c = citation.model_dump()
            else:
                c = vars(citation)
            citation_id = c.get("citation_id") or c.get("citationId") or f"cit-{ordinal}"
            await self.snapshots.replace_one({"tenantId": doc["tenantId"], "messageId": message.id,
                "citationId": citation_id}, {"_id": f"{message.id}:{citation_id}", "tenantId": doc["tenantId"],
                "ownerUserId": doc["ownerUserId"], "conversationId": message.conversation_id,
                "messageId": message.id, "citationId": citation_id, "ordinal": ordinal,
                "evidenceId": c.get("evidence_id", c.get("evidenceId", "")),
                "documentId": c.get("document_id", c.get("documentId", "")),
                "documentName": c.get("document_name", c.get("documentName", c.get("title", ""))),
                "documentVersion": c.get("document_version", c.get("documentVersion")),
                "pageFrom": c.get("page_from", c.get("pageFrom", c.get("page_number", 1))),
                "pageTo": c.get("page_to", c.get("pageTo", c.get("page_number", 1))),
                "snippet": c.get("snippet", ""), "sourceType": c.get("source_type", c.get("sourceType", "official"))},
                upsert=True, session=session)

    async def delete_by_conversation(self, conversation_id: str, tenant_id: str, owner_user_id: str) -> int:
        session = await self.uow.ensure_transaction()
        query = {"conversationId": conversation_id, "tenantId": tenant_id, "ownerUserId": owner_user_id}
        await self.snapshots.delete_many({"tenantId": tenant_id, "ownerUserId": owner_user_id,
            "conversationId": conversation_id}, session=session)
        result = await self.collection.delete_many(query, session=session)
        return result.deleted_count
