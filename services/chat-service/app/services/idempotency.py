"""Scoped idempotency coordinator for the VT-002 executable Chat harness.

Not wired to FastAPI: a production repository must atomically persist the
business message and its replay record under a unique scoped key. The injected
operation must not commit an unprotected external side effect itself.
"""
import asyncio
from copy import deepcopy
from hashlib import sha256
import json

MAX_QUESTION_LENGTH = 4000
MAX_KEY_LENGTH = 64
PAYLOAD_FIELDS = frozenset({"question", "conversation_id", "include_personal_docs"})


class IdempotencyError(Exception):
    """Stable HTTP-shaped error for the standalone harness boundary."""
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


def normalize(scope, key, payload):
    """Validate context/key and snapshot every semantic CourseChatRequest field."""
    if not isinstance(scope, tuple) or len(scope) != 3 or not all(
        isinstance(part, str) and part for part in scope
    ):
        raise IdempotencyError(400, "INVALID_SCOPE")
    if not isinstance(key, str) or not key or len(key) > MAX_KEY_LENGTH or not all(
        char.isascii() and (char.isalnum() or char in "-_") for char in key
    ):
        raise IdempotencyError(400, "INVALID_KEY")
    if not isinstance(payload, dict) or not payload.keys() <= PAYLOAD_FIELDS:
        raise IdempotencyError(400, "INVALID_PAYLOAD")
    question = payload.get("question")
    if not isinstance(question, str) or not question or len(question) > MAX_QUESTION_LENGTH:
        raise IdempotencyError(400, "INVALID_QUESTION")
    conversation = payload.get("conversation_id")
    personal = payload.get("include_personal_docs", False)
    if (conversation is not None and not isinstance(conversation, str)) or not isinstance(personal, bool):
        raise IdempotencyError(400, "INVALID_PAYLOAD")
    snapshot = {"question": question, "conversation_id": conversation, "include_personal_docs": personal}
    fingerprint = sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False,
                                    separators=(",", ":")).encode("utf-8")).hexdigest()
    return (*scope, key), fingerprint, snapshot


class IdempotencyCoordinator:
    """Coalesce pending work; replay from an injected repository.

    Scope is a pre-authorized (tenant, user, course) tuple, never trusted headers.
    Two coordinators may compute twice; insert_once must expose one stored result.
    """
    def __init__(self, repository, operation):
        self.repository = repository
        self.operation = operation
        self._pending = {}
        self._lock = asyncio.Lock()

    async def execute(self, scope, key, payload):
        """Return a detached result or raise 400/409/backend error; no expiry clock."""
        scoped_key, fingerprint, snapshot = normalize(scope, key, payload)
        async with self._lock:
            pending = self._pending.get(scoped_key)
            if pending is not None:
                if pending[0] != fingerprint:
                    raise IdempotencyError(409, "KEY_CONFLICT")
                task = pending[1]
            else:
                task = asyncio.create_task(self._perform(scoped_key, fingerprint, snapshot))
                self._pending[scoped_key] = (fingerprint, task)
        # A disconnected waiter must not cancel another's shared operation.
        return deepcopy(await asyncio.shield(task))

    async def _perform(self, scoped_key, fingerprint, snapshot):
        try:
            existing = await self.repository.get(scoped_key)
            if existing is not None:
                if existing[0] != fingerprint:
                    raise IdempotencyError(409, "KEY_CONFLICT")
                return existing[1]
            result = await self.operation(scoped_key[:3], snapshot)
            return await self.repository.insert_once(scoped_key, fingerprint, result)
        finally:
            # Completed results belong to the repository, not an unbounded cache.
            async with self._lock:
                self._pending.pop(scoped_key, None)
