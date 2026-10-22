"""PostgreSQL implementation of IMessageRepository."""
from app.domain.repositories.message_repository import IMessageRepository

class PostgresMessageRepository(IMessageRepository):
    def __init__(self, session):
        self.session = session
