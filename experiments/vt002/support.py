"""Offline harness adapters. Not a production database or authentication layer."""
import asyncio
from copy import deepcopy
from pathlib import Path
import sys

CHAT_ROOT = Path(__file__).resolve().parents[2] / "services" / "chat-service"
sys.path.insert(0, str(CHAT_ROOT))
from app.services.idempotency import IdempotencyError, IdempotencyCoordinator


class MemoryRepository:
    """Simulates a unique constraint and atomic committed-result snapshot."""
    def __init__(self):
        self.rows = {}
        self.commits = 0
        self.lock = asyncio.Lock()

    async def get(self, scoped_key):
        async with self.lock:
            return deepcopy(self.rows.get(scoped_key))

    async def insert_once(self, scoped_key, fingerprint, result):
        async with self.lock:
            existing = self.rows.get(scoped_key)
            if existing is not None:
                if existing[0] != fingerprint:
                    raise IdempotencyError(409, "KEY_CONFLICT")
                return deepcopy(existing[1])
            self.rows[scoped_key] = (fingerprint, deepcopy(result))
            self.commits += 1
            return deepcopy(result)


class FakeRag:
    """Synthetic operation with event-controlled failure and overlap."""
    def __init__(self):
        self.calls = 0
        self.active = 0
        self.max_active = 0
        self.fail_next = False
        self.pause = False
        self.entered = asyncio.Event()
        self.release = asyncio.Event()

    async def __call__(self, scope, payload):
        self.calls += 1
        message_id = f"message-{self.calls:04}"
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        self.entered.set()
        try:
            if self.pause:
                await self.release.wait()
            else:
                await asyncio.sleep(0)  # Scheduler yield, no wall-clock delay.
            if self.fail_next:
                self.fail_next = False
                raise RuntimeError("synthetic failure before commit")
            return {"message_id": message_id, "answer": payload["question"],
                    "citations": [{"document_id": "synthetic-doc"}]}
        finally:
            self.active -= 1


class HarnessApi:
    """In-process API-shaped facade; context is pretrusted by the fixture."""
    def __init__(self, coordinator):
        self.coordinator = coordinator

    async def post(self, scope, key, payload):
        try:
            result = await self.coordinator.execute(scope, key, payload)
            return {"status": 200, "body": result}
        except IdempotencyError as error:
            return {"status": error.status, "code": error.code}
        except RuntimeError:
            return {"status": 503, "code": "BACKEND_FAILED"}


def fixture():
    repository, backend = MemoryRepository(), FakeRag()
    coordinator = IdempotencyCoordinator(repository, backend)
    return repository, backend, coordinator, HarnessApi(coordinator)
