"""PostgreSQL implementation of IFeedbackRepository."""
from app.domain.repositories.feedback_repository import IFeedbackRepository

class PostgresFeedbackRepository(IFeedbackRepository):
    def __init__(self, session):
        self.session = session
