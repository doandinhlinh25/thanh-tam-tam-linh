"""Common FastAPI dependency injection providers."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.database.session import get_db_session
from app.integrations.database.unit_of_work import UnitOfWork


async def get_session() -> AsyncSession:
    async for session in get_db_session():
        yield session


async def get_uow(session: AsyncSession = Depends(get_session)) -> UnitOfWork:
    return UnitOfWork(session)
