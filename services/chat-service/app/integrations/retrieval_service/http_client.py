"""HTTP client wrapping calls to external Retrieval Service."""
import httpx
from app.core.config import settings

class RetrievalServiceHttpClient:
    def __init__(self):
        self.base_url = settings.RETRIEVAL_SERVICE_URL
        self.timeout = settings.RETRIEVAL_TIMEOUT_SECONDS

    async def get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)
