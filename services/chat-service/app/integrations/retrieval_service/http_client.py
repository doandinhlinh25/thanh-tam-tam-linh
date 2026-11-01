"""HTTP client wrapping calls to external Retrieval Service."""
from typing import Optional, Any
import httpx
from app.core.config import get_settings
from app.core.exceptions import AppBaseException
from app.integrations.retrieval_service.exceptions import (
    RetrievalServiceUnavailableException,
    RetrievalTimeoutException,
    RetrievalClientException,
    RetrievalServiceException,
    RetrievalForbiddenException,
    RetrievalRateLimitException,
    RetrievalInvalidResponseException,
    RETRIEVAL_ERROR_MESSAGE,
    RETRIEVAL_UNAVAILABLE_MESSAGE,
    RETRIEVAL_TIMEOUT_MESSAGE,
    RETRIEVAL_CLIENT_ERROR_MESSAGE,
    RETRIEVAL_FORBIDDEN_MESSAGE,
    RETRIEVAL_RATE_LIMIT_MESSAGE,
    RETRIEVAL_INVALID_RESPONSE_MESSAGE,
)


HTTP_OK = 200
HTTP_FORBIDDEN = 403
HTTP_RATE_LIMITED = 429
HTTP_UNAVAILABLE = 503
HTTP_TIMEOUT_STATUSES = (408, 504)
HTTP_CLIENT_ERROR_START = 400
HTTP_SERVER_ERROR_START = 500
RETRIEVAL_UNAVAILABLE_CODES = frozenset(("SERVICE_UNAVAILABLE", "INDEX_NOT_READY"))
RETRIEVAL_TIMEOUT_CODES = frozenset(("TIMEOUT", "GATEWAY_TIMEOUT"))
RETRIEVAL_FORBIDDEN_CODES = frozenset(("FORBIDDEN", "ACCESS_DENIED"))
RETRIEVAL_RATE_LIMIT_CODES = frozenset(("RATE_LIMITED", "TOO_MANY_REQUESTS"))


class RetrievalServiceHttpClient:
    """Low-level HTTP client interfacing with Document Service internal retrieval endpoints."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ):
        settings = get_settings()
        configured_url = base_url or getattr(settings, "RETRIEVAL_SERVICE_URL", "http://localhost:8001")
        self.base_url = str(configured_url).rstrip("/")
        configured_timeout = timeout or getattr(settings, "RETRIEVAL_TIMEOUT_SECONDS", 10.0)
        self.timeout = float(configured_timeout)
        self._client = client

    async def get_client(self) -> httpx.AsyncClient:
        """Return an active httpx.AsyncClient instance with persistent connection pooling."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)
        return self._client

    async def post_search(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send a retrieval search and reject unsafe or malformed upstream results.

        :param payload: Existing search request for the internal retrieval route.
        :returns: A successful envelope with a candidate list.
        :raises AppBaseException: A sanitized technical or authorization failure.
        """
        if self.base_url.endswith("/internal/v1"):
            path = "/retrieval/search"
        else:
            path = "/internal/v1/retrieval/search"

        client = await self.get_client()

        try:
            response = await client.post(path, json=payload)
            if response.status_code == HTTP_OK:
                try:
                    data = response.json()
                except ValueError as exc:
                    raise RetrievalInvalidResponseException(RETRIEVAL_INVALID_RESPONSE_MESSAGE) from exc

                if not isinstance(data, dict):
                    raise RetrievalInvalidResponseException(RETRIEVAL_INVALID_RESPONSE_MESSAGE)
                if data.get("successful") is False:
                    error = data.get("error")
                    code = error.get("errorCode") if isinstance(error, dict) else None
                    if code in RETRIEVAL_UNAVAILABLE_CODES:
                        raise RetrievalServiceUnavailableException(RETRIEVAL_UNAVAILABLE_MESSAGE)
                    if code in RETRIEVAL_TIMEOUT_CODES:
                        raise RetrievalTimeoutException(RETRIEVAL_TIMEOUT_MESSAGE)
                    if code in RETRIEVAL_FORBIDDEN_CODES:
                        raise RetrievalForbiddenException(RETRIEVAL_FORBIDDEN_MESSAGE)
                    if code in RETRIEVAL_RATE_LIMIT_CODES:
                        raise RetrievalRateLimitException(RETRIEVAL_RATE_LIMIT_MESSAGE)
                    raise RetrievalServiceException(RETRIEVAL_ERROR_MESSAGE)
                result = data.get("data")
                if (
                    data.get("successful") is not True
                    or not isinstance(result, dict)
                    or not isinstance(result.get("candidates"), list)
                ):
                    raise RetrievalInvalidResponseException(RETRIEVAL_INVALID_RESPONSE_MESSAGE)
                return data
            if response.status_code == HTTP_FORBIDDEN:
                raise RetrievalForbiddenException(RETRIEVAL_FORBIDDEN_MESSAGE)
            if response.status_code == HTTP_RATE_LIMITED:
                raise RetrievalRateLimitException(RETRIEVAL_RATE_LIMIT_MESSAGE)
            if response.status_code == HTTP_UNAVAILABLE:
                raise RetrievalServiceUnavailableException(RETRIEVAL_UNAVAILABLE_MESSAGE)
            if response.status_code in HTTP_TIMEOUT_STATUSES:
                raise RetrievalTimeoutException(RETRIEVAL_TIMEOUT_MESSAGE)
            if HTTP_CLIENT_ERROR_START <= response.status_code < HTTP_SERVER_ERROR_START:
                raise RetrievalClientException(RETRIEVAL_CLIENT_ERROR_MESSAGE)
            raise RetrievalServiceException(RETRIEVAL_ERROR_MESSAGE)
        except httpx.TimeoutException as exc:
            raise RetrievalTimeoutException(RETRIEVAL_TIMEOUT_MESSAGE) from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            raise RetrievalServiceUnavailableException(RETRIEVAL_UNAVAILABLE_MESSAGE) from exc
        except AppBaseException:
            raise
        except Exception as exc:
            raise RetrievalServiceException(RETRIEVAL_ERROR_MESSAGE) from exc

    async def close(self) -> None:
        """Close managed httpx client if active."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    async def aclose(self) -> None:
        """Alias for close()."""
        await self.close()

    async def __aenter__(self) -> "RetrievalServiceHttpClient":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()
