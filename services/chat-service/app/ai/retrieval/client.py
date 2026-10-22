"""Client for interacting with Retrieval Service."""
from app.ai.retrieval.schemas import RetrievalRequest, RetrievalResponse

class RetrievalClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def retrieve(self, request: RetrievalRequest) -> RetrievalResponse:
        raise NotImplementedError
