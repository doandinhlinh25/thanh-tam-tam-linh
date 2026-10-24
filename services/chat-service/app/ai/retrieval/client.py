"""Client for interacting with Retrieval Service."""
import uuid
from typing import Optional, Union, List, Any
import httpx

from app.core.config import get_settings
from app.domain.value_objects.evidence import Evidence
from app.ai.retrieval.schemas import SearchRequest, RetrievalRequest
from app.ai.retrieval.mapper import RetrievalMapper
from app.integrations.retrieval_service.http_client import RetrievalServiceHttpClient


class RetrievalClient:
    """Retrieval Client communicating with Document Service POST /internal/v1/retrieval/search."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        http_client: Optional[Union[httpx.AsyncClient, RetrievalServiceHttpClient]] = None,
        timeout: Optional[float] = None,
    ):
        settings = get_settings()
        self.base_url = (base_url or getattr(settings, "RETRIEVAL_SERVICE_URL", "http://localhost:8001")).rstrip("/")
        if isinstance(http_client, RetrievalServiceHttpClient):
            self.service_http_client = http_client
        else:
            self.service_http_client = RetrievalServiceHttpClient(
                base_url=self.base_url,
                timeout=timeout,
                client=http_client,
            )

    async def search(
        self,
        request: Union[SearchRequest, RetrievalRequest, dict[str, Any]],
    ) -> List[Evidence]:
        """Search authorized evidence candidates conforming to Document Service contract."""
        payload = self._build_search_payload(request)
        response_data = await self.service_http_client.post_search(payload)
        return RetrievalMapper.to_domain(response_data)

    async def retrieve(
        self,
        request: Union[SearchRequest, RetrievalRequest, dict[str, Any]],
    ) -> List[Evidence]:
        """Retrieve evidence candidates for RAG pipeline (primary interface)."""
        return await self.search(request)

    def _build_search_payload(
        self, request: Union[SearchRequest, RetrievalRequest, dict[str, Any]]
    ) -> dict[str, Any]:
        """Format request into structured SearchRequest adhering strictly to OpenAPI contract."""
        if isinstance(request, SearchRequest):
            return request.to_payload()

        if isinstance(request, dict):
            req_id = (
                request.get("requestId")
                or request.get("request_id")
                or f"req-{uuid.uuid4().hex[:12]}"
            )
            tenant_id = str(request.get("tenantId") or request.get("tenant_id") or "")
            course_id = str(request.get("courseId") or request.get("course_id") or "")
            actor_user_id = str(
                request.get("actorUserId")
                or request.get("actor_user_id")
                or request.get("user_id")
                or ""
            )
            query = str(request.get("query") or "")
            try:
                candidate_k = max(
                    1,
                    int(
                        request.get("candidateK")
                        or request.get("candidate_k")
                        or request.get("top_k")
                        or 8
                    ),
                )
            except (ValueError, TypeError):
                candidate_k = 8

            payload: dict[str, Any] = {
                "tenantId": tenant_id,
                "courseId": course_id,
                "actorUserId": actor_user_id,
                "query": query,
                "candidateK": candidate_k,
                "requestId": req_id,
            }
            if "expectedIndexVersion" in request:
                payload["expectedIndexVersion"] = request["expectedIndexVersion"]
            elif "expected_index_version" in request:
                payload["expectedIndexVersion"] = request["expected_index_version"]
            return payload

        if isinstance(request, RetrievalRequest):
            return {
                "tenantId": request.tenant_id,
                "courseId": request.course_id or "",
                "actorUserId": request.user_id or "",
                "query": request.query,
                "candidateK": max(1, request.top_k),
                "requestId": f"req-{uuid.uuid4().hex[:12]}",
            }

        raise ValueError(f"Unsupported request type for RetrievalClient: {type(request)}")

    async def close(self) -> None:
        """Close underlying HTTP client."""
        await self.service_http_client.close()

    async def aclose(self) -> None:
        """Alias for close()."""
        await self.close()

    async def __aenter__(self) -> "RetrievalClient":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()
