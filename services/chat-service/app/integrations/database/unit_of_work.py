"""Request-scoped MongoDB unit of work with explicit short transactions."""
from typing import Any, Self

from pymongo import AsyncMongoClient

from app.repositories.mongodb.conversation_repository import MongoConversationRepository
from app.repositories.mongodb.feedback_repository import MongoFeedbackRepository
from app.repositories.mongodb.message_repository import MongoMessageRepository


class UnitOfWork:
    def __init__(self, client: AsyncMongoClient, database: Any):
        self.client = client
        self.database = database
        self.session: Any | None = None
        self._transaction_active = False
        self.conversations = MongoConversationRepository(self)
        self.messages = MongoMessageRepository(self)
        self.feedbacks = MongoFeedbackRepository(self)

    async def begin(self) -> None:
        if self._transaction_active:
            return
        if self.session is None:
            self.session = self.client.start_session()
        await self.session.start_transaction()
        self._transaction_active = True

    async def ensure_transaction(self) -> Any:
        await self.begin()
        assert self.session is not None
        return self.session

    def session_option(self) -> dict[str, Any]:
        return {"session": self.session} if self._transaction_active else {}

    async def commit(self) -> None:
        if self._transaction_active and self.session is not None:
            try:
                await self.session.commit_transaction()
            except Exception:
                try:
                    await self.session.abort_transaction()
                finally:
                    self._transaction_active = False
                raise
            else:
                self._transaction_active = False

    async def rollback(self) -> None:
        if self._transaction_active and self.session is not None:
            try:
                await self.session.abort_transaction()
            finally:
                self._transaction_active = False

    async def close(self) -> None:
        await self.rollback()
        if self.session is not None:
            await self.session.end_session()
            self.session = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type:
            await self.rollback()
        await self.close()
