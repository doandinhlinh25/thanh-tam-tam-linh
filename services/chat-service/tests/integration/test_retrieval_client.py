"""Integration tests for RetrievalServiceClient."""
import pytest
import httpx
from app.ai.retrieval.client import RetrievalClient
from app.ai.retrieval.schemas import SearchRequest
from app.domain.value_objects.evidence import Evidence
from app.integrations.retrieval_service.exceptions import (
    RetrievalServiceUnavailableException,
    RetrievalTimeoutException,
    RetrievalClientException,
    RetrievalServiceException,
)


def test_retrieval_client_placeholder():
    """Placeholder test preserved for backward compatibility."""
    assert True


@pytest.mark.asyncio
async def test_retrieval_client_search_success():
    mock_response = {
        "successful": True,
        "data": {
            "requestId": "req-101",
            "indexVersion": "v1.0",
            "embeddingModelVersion": "text-embedding-3-small",
            "candidates": [
                {
                    "evidenceId": "ev-1",
                    "chunkId": "chunk-1",
                    "documentId": "doc-1",
                    "documentVersion": 1,
                    "documentName": "Intro.pdf",
                    "pageFrom": 1,
                    "pageTo": 2,
                    "text": "Course syllabus overview.",
                    "retrievalScore": 0.89,
                }
            ],
        },
        "error": None,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert "/internal/v1/retrieval/search" in str(request.url)
        return httpx.Response(200, json=mock_response)

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(
        tenant_id="tenant-1",
        course_id="course-1",
        actor_user_id="user-1",
        query="Tell me about the course",
        candidate_k=5,
    )
    results = await client.search(req)

    assert len(results) == 1
    assert isinstance(results[0], Evidence)
    assert results[0].evidence_id == "ev-1"
    assert results[0].document_name == "Intro.pdf"
    assert results[0].page_from == 1
    assert results[0].page_to == 2
    assert results[0].retrieval_score == 0.89


@pytest.mark.asyncio
async def test_retrieval_client_retrieve_alias():
    mock_response = {
        "successful": True,
        "data": {
            "requestId": "req-102",
            "candidates": [
                {
                    "evidenceId": "ev-2",
                    "chunkId": "chunk-2",
                    "documentId": "doc-2",
                    "documentVersion": 1,
                    "documentName": "Guide.pdf",
                    "pageFrom": 4,
                    "pageTo": 4,
                    "text": "Grading criteria.",
                    "retrievalScore": 0.75,
                }
            ],
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_response)

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    results = await client.retrieve({"query": "grading", "tenant_id": "t1", "user_id": "u1"})
    assert len(results) == 1
    assert results[0].evidence_id == "ev-2"


@pytest.mark.asyncio
async def test_retrieval_client_empty_results():
    mock_response = {
        "successful": True,
        "data": {
            "requestId": "req-empty",
            "candidates": [],
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=mock_response)

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(
        tenant_id="t1",
        course_id="c1",
        actor_user_id="u1",
        query="Non-existent topic",
    )
    results = await client.search(req)
    assert results == []


@pytest.mark.asyncio
async def test_retrieval_client_503_service_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="Retrieval index not ready")

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(tenant_id="t1", course_id="c1", actor_user_id="u1", query="test")
    with pytest.raises(RetrievalServiceUnavailableException) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_retrieval_client_network_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Socket read timed out")

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(tenant_id="t1", course_id="c1", actor_user_id="u1", query="timeout query")
    with pytest.raises(RetrievalTimeoutException) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code == 504


@pytest.mark.asyncio
async def test_retrieval_client_connection_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Failed to connect to retrieval host")

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(tenant_id="t1", course_id="c1", actor_user_id="u1", query="conn query")
    with pytest.raises(RetrievalServiceUnavailableException) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_retrieval_client_400_bad_request():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text="Invalid internal request payload")

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(tenant_id="t1", course_id="c1", actor_user_id="u1", query="bad request")
    with pytest.raises(RetrievalClientException) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_retrieval_client_500_internal_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal vector store failure")

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(tenant_id="t1", course_id="c1", actor_user_id="u1", query="server error")
    with pytest.raises(RetrievalServiceException) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_retrieval_client_504_gateway_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(504, text="Gateway Timeout")

    transport = httpx.MockTransport(handler)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://test-retrieval")
    client = RetrievalClient(http_client=async_client)

    req = SearchRequest(tenant_id="t1", course_id="c1", actor_user_id="u1", query="gw timeout")
    with pytest.raises(RetrievalTimeoutException) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code == 504


# --- Real Network Socket Integration Tests (Deep Socket Verification) ---

import threading
import http.server
import json
import time
import asyncio


class _LiveRetrievalHttpServer:
    """Ephemeral HTTP server for verifying RetrievalClient against real TCP network sockets."""

    def __init__(self, delay_seconds: float = 0.0):
        self.delay_seconds = delay_seconds
        self.server: http.server.HTTPServer = None
        self.port: int = 0
        self.thread: threading.Thread = None

    def __enter__(self):
        delay = self.delay_seconds

        class _Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                if delay > 0:
                    time.sleep(delay)
                content_len = int(self.headers.get("Content-Length", 0))
                _ = self.rfile.read(content_len)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                resp = {
                    "successful": True,
                    "data": {
                        "requestId": "req-live-socket-1",
                        "indexVersion": "v1.0",
                        "embeddingModelVersion": "text-embedding-3-small",
                        "candidates": [
                            {
                                "evidenceId": "ev-socket-001",
                                "chunkId": "chunk-live-1",
                                "documentId": "doc-live-100",
                                "documentVersion": 2,
                                "documentName": "LiveCourseData.pdf",
                                "pageFrom": 4,
                                "pageTo": 5,
                                "text": "Verified over real TCP loopback socket connection.",
                                "retrievalScore": 0.945,
                            }
                        ],
                    },
                    "error": None,
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))

            def log_message(self, format, *args):
                pass  # Suppress console noise

        self.server = http.server.HTTPServer(("127.0.0.1", 0), _Handler)
        self.port = self.server.server_port
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.server:
            self.server.shutdown()
            self.server.server_close()


@pytest.mark.asyncio
async def test_retrieval_client_live_tcp_socket_search_success():
    """Verify RetrievalClient successfully communicates with Document Service over real TCP network socket."""
    with _LiveRetrievalHttpServer() as live_server:
        client = RetrievalClient(base_url=f"http://127.0.0.1:{live_server.port}", timeout=5.0)
        req = SearchRequest(
            tenant_id="tenant-live-1",
            course_id="course-live-1",
            actor_user_id="user-live-1",
            query="Verify real socket communication",
            candidate_k=5,
        )
        results = await client.search(req)

        assert len(results) == 1
        ev = results[0]
        assert ev.evidence_id == "ev-socket-001"
        assert ev.document_name == "LiveCourseData.pdf"
        assert ev.page_from == 4
        assert ev.page_to == 5
        assert "real TCP loopback socket" in ev.text
        assert abs(ev.retrieval_score - 0.945) < 1e-5


@pytest.mark.asyncio
async def test_retrieval_client_live_tcp_socket_connection_refused():
    """Verify RetrievalClient raises RetrievalServiceUnavailableException or RetrievalTimeoutException when TCP socket refuses connection."""
    # Find an unopened socket port
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    closed_port = s.getsockname()[1]
    s.close()

    client = RetrievalClient(base_url=f"http://127.0.0.1:{closed_port}", timeout=0.3)
    req = SearchRequest(
        tenant_id="t1",
        course_id="c1",
        actor_user_id="u1",
        query="test connection failure",
    )
    with pytest.raises((RetrievalServiceUnavailableException, RetrievalTimeoutException)) as exc_info:
        await client.search(req)
    assert exc_info.value.status_code in (503, 504)


@pytest.mark.asyncio
async def test_retrieval_client_live_tcp_socket_timeout():
    """Verify RetrievalClient raises RetrievalTimeoutException when live TCP socket read exceeds timeout."""
    # Server delays response by 0.8s, client timeout set to 0.15s
    with _LiveRetrievalHttpServer(delay_seconds=0.8) as live_server:
        client = RetrievalClient(base_url=f"http://127.0.0.1:{live_server.port}", timeout=0.15)
        req = SearchRequest(
            tenant_id="t1",
            course_id="c1",
            actor_user_id="u1",
            query="test real socket timeout",
        )
        with pytest.raises(RetrievalTimeoutException) as exc_info:
            await client.search(req)
        assert exc_info.value.status_code == 504


@pytest.mark.asyncio
async def test_retrieval_client_live_tcp_concurrent_requests():
    """Verify RetrievalClient concurrently issues multiple requests over real TCP socket without socket leaks."""
    with _LiveRetrievalHttpServer() as live_server:
        client = RetrievalClient(base_url=f"http://127.0.0.1:{live_server.port}", timeout=5.0)

        tasks = [
            client.search(
                SearchRequest(
                    tenant_id=f"tenant-{i}",
                    course_id=f"course-{i}",
                    actor_user_id=f"user-{i}",
                    query=f"Query {i}",
                )
            )
            for i in range(10)
        ]
        results_list = await asyncio.gather(*tasks)

        assert len(results_list) == 10
        for results in results_list:
            assert len(results) == 1
            assert results[0].evidence_id == "ev-socket-001"
        await client.close()


@pytest.mark.asyncio
async def test_retrieval_client_connection_pool_reuse_and_lifecycle():
    """Verify RetrievalClient reuses persistent HTTP connection pool across sequential requests and closes cleanly."""
    with _LiveRetrievalHttpServer() as live_server:
        async with RetrievalClient(base_url=f"http://127.0.0.1:{live_server.port}", timeout=5.0) as client:
            http_client = await client.service_http_client.get_client()

            req = SearchRequest(
                tenant_id="t-pool-1",
                course_id="c-pool-1",
                actor_user_id="u-pool-1",
                query="Pool test 1",
            )
            res1 = await client.search(req)
            assert len(res1) == 1

            # Second request must reuse the exact same persistent AsyncClient instance
            http_client_second = await client.service_http_client.get_client()
            assert http_client_second is http_client
            assert not http_client.is_closed

            res2 = await client.search(req)
            assert len(res2) == 1

        # After async with exits, underlying client is closed
        assert http_client.is_closed

