"""Common FastAPI dependency injection providers."""
from app.integrations.database.session import get_db_session

async def get_session():
    async for session in get_db_session():
        yield session
