"""Common FastAPI dependency injection providers."""
from collections.abc import AsyncIterator

from app.integrations.database.session import get_client, get_database
from app.integrations.database.unit_of_work import UnitOfWork


async def get_uow() -> AsyncIterator[UnitOfWork]:
    database = await get_database()
    uow = UnitOfWork(get_client(), database)
    try:
        yield uow
    finally:
        await uow.close()
