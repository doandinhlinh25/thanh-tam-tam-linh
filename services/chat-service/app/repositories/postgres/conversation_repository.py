"""PostgreSQL implementation of IConversationRepository."""
from app.domain.repositories.conversation_repository import IConversationRepository

class PostgresConversationRepository(IConversationRepository):
    def __init__(self, session):
        self.session = session
