"""HTTP client wrapping calls to external Retrieval Service."""
from typing import Optional, Any
import httpx
from app.core.config import get_settings
from app.integrations.retrieval_service.exceptions import (
    RetrievalServiceUnavailableException,
    RetrievalTimeoutException,
    RetrievalClientException,
    RetrievalServiceException,
)


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
        """POST /internal/v1/retrieval/search with payload conforming to OpenAPI contract."""
        if self.base_url.endswith("/internal/v1"):
            path = "/retrieval/search"
        else:
            path = "/internal/v1/retrieval/search"

        client = await self.get_client()

        try:
            response = await client.post(path, json=payload)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and data.get("successful") is False:
                    err_info = data.get("error") or {}
                    err_code = err_info.get("errorCode", "RETRIEVAL_ERROR")
                    err_msg = err_info.get("errorMessage", str(err_info))
                    if err_code in ("SERVICE_UNAVAILABLE", "INDEX_NOT_READY"):
                        raise RetrievalServiceUnavailableException(
                            f"Retrieval Service unavailable: {err_msg}",
                            details={"status_code": 503, "error": err_info},
                        )
                    if err_code in ("TIMEOUT", "GATEWAY_TIMEOUT"):
                        raise RetrievalTimeoutException(
                            f"Retrieval Service timeout: {err_msg}",
                            details={"status_code": 504, "error": err_info},
                        )
                    raise RetrievalServiceException(
                        f"Retrieval Service error ({err_code}): {err_msg}",
                        details={"error": err_info},
                    )
                return data
            elif response.status_code == 503:
                raise RetrievalServiceUnavailableException(
                    f"Retrieval Service unavailable (HTTP 503): {response.text}",
                    details={"status_code": 503, "response": response.text},
                )
            elif response.status_code in (504, 408):
                raise RetrievalTimeoutException(
                    f"Retrieval Service request timed out (HTTP {response.status_code}): {response.text}",
                    details={"status_code": response.status_code, "response": response.text},
                )
            elif 400 <= response.status_code < 500:
                raise RetrievalClientException(
                    f"Retrieval Service client error (HTTP {response.status_code}): {response.text}",
                    details={"status_code": response.status_code, "response": response.text},
                )
            else:
                raise RetrievalServiceException(
                    f"Retrieval Service unexpected error (HTTP {response.status_code}): {response.text}",
                    details={"status_code": response.status_code, "response": response.text},
                )
        except httpx.TimeoutException as exc:
            raise RetrievalTimeoutException(f"Retrieval Service timed out: {exc}") from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            raise RetrievalServiceUnavailableException(
                f"Retrieval Service connection failed: {exc}"
            ) from exc
        except (
            RetrievalServiceUnavailableException,
            RetrievalTimeoutException,
            RetrievalClientException,
            RetrievalServiceException,
        ):
            raise
        except Exception as exc:
            raise RetrievalServiceException(
                f"Unexpected error communicating with Retrieval Service: {exc}"
            ) from exc

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
