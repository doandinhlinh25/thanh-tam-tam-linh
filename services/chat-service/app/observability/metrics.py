"""Prometheus metrics definitions for Chat Service."""
from prometheus_client import Counter, Histogram

CHAT_REQUESTS_TOTAL = Counter(
    "chat_requests_total",
    "Total number of chat queries processed",
    ["status", "course_id"]
)

CHAT_LATENCY_SECONDS = Histogram(
    "chat_latency_seconds",
    "Latency of chat query processing in seconds",
    ["step"]
)

REFUSALS_TOTAL = Counter(
    "chat_refusals_total",
    "Total number of safe refusals issued",
    ["reason"]
)
