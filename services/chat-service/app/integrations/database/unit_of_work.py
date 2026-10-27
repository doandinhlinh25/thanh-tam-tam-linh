"""Unit of Work pattern for managing transaction boundaries."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.postgres.conversation_repository import PostgresConversationRepository
from app.repositories.postgres.message_repository import PostgresMessageRepository
from app.repositories.postgres.feedback_repository import PostgresFeedbackRepository


class UnitOfWork:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.conversations = PostgresConversationRepository(session)
        self.messages = PostgresMessageRepository(session)
        self.feedbacks = PostgresFeedbackRepository(session)

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()

    async def __aenter__(self) -> "UnitOfWork":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type:
            await self.rollback()
        else:
            try:
                await self.commit()
            except Exception:
                await self.rollback()
                raise
