"""Database engine and session lifecycle management."""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.repositories.models.base import Base
# Ensure all models are registered with Base.metadata
import app.repositories.models.conversation_model  # noqa: F401
import app.repositories.models.message_model  # noqa: F401
import app.repositories.models.feedback_model  # noqa: F401

logger = logging.getLogger(__name__)


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def _create_engine():
    db_url = _normalize_db_url(settings.DATABASE_URL)
    try:
        if "postgresql" in db_url:
            import asyncpg  # noqa: F401
        eng = create_async_engine(db_url, echo=False)
        return eng
    except Exception as e:
        logger.warning(
            "PostgreSQL driver or container not available, falling back to SQLite in-memory: %s",
            e,
        )
        fallback_url = "sqlite+aiosqlite:///:memory:"
        eng = create_async_engine(
            fallback_url,
            echo=False,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
        return eng


engine = _create_engine()
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

_db_initialized = False


async def ensure_db_initialized():
    """Ensure database schema tables are created with automatic SQLite fallback if container is offline."""
    global _db_initialized, engine, AsyncSessionLocal
    if not _db_initialized:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            _db_initialized = True
        except Exception as e:
            logger.warning(
                "Database initialization failed (%s); falling back to in-memory SQLite",
                e,
            )
            fallback_url = "sqlite+aiosqlite:///:memory:"
            engine = create_async_engine(
                fallback_url,
                echo=False,
                poolclass=StaticPool,
                connect_args={"check_same_thread": False},
            )
            AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            _db_initialized = True


async def get_db_session():
    """FastAPI generator providing an async database session."""
    await ensure_db_initialized()
    async with AsyncSessionLocal() as session:
        yield session

