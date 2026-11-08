"""VT-002 risk-based tests; all fixtures are local and freshly constructed."""
import asyncio
import os
import random
import unittest
from pairwise import ROWS, uncovered_pairs
from support import fixture, IdempotencyCoordinator

SCOPE = ("tenant-A", "user-A", "course-A")
BODY = {"question": "Q"}


class IdempotencyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repo, self.backend, self.service, self.api = fixture()

    async def test_T09_conflicting_question_is_409_without_write(self):
        self.assertEqual((await self.api.post(SCOPE, "key", BODY))["status"], 200)
        result = await self.api.post(SCOPE, "key", {"question": "different"})
        self.assertEqual(result, {"status": 409, "code": "KEY_CONFLICT"})
        self.assertEqual((self.backend.calls, self.repo.commits), (1, 1))

    async def test_T10_all_semantic_payload_fields_are_fingerprinted(self):
        for changed in ({"conversation_id": "conversation-B"}, {"include_personal_docs": True}):
            with self.subTest(changed=changed):
                repo, backend, _, api = fixture()
                await api.post(SCOPE, "key", BODY)
                result = await api.post(SCOPE, "key", {**BODY, **changed})
                self.assertEqual(result["status"], 409)
                self.assertEqual((backend.calls, repo.commits), (1, 1))
        original = await self.api.post(SCOPE, "key", BODY)
        explicit_defaults = await self.api.post(SCOPE, "key", {
            "question": "Q", "conversation_id": None, "include_personal_docs": False})
        self.assertEqual(original, explicit_defaults)
        self.assertEqual(self.repo.commits, 1)

    async def test_T11_key_is_scoped_by_tenant_user_and_course(self):
        scopes = [SCOPE, ("tenant-B", SCOPE[1], SCOPE[2]),
                  (SCOPE[0], "user-B", SCOPE[2]), (SCOPE[0], SCOPE[1], "course-B")]
        replies = [await self.api.post(scope, "same-key", BODY) for scope in scopes]
        self.assertTrue(all(reply["status"] == 200 for reply in replies))
        self.assertEqual(len({reply["body"]["message_id"] for reply in replies}), 4)
        self.assertEqual((len(self.repo.rows), self.repo.commits), (4, 4))

    async def test_T12_invalid_keys_do_not_invoke_backend(self):
        for key in (None, "", "space key", "x" * 65, "unicode-\u00e9", 3):
            with self.subTest(key=key):
                self.assertEqual((await self.api.post(SCOPE, key, BODY))["status"], 400)
        self.assertEqual((self.backend.calls, self.repo.commits), (0, 0))
        self.assertEqual((await self.api.post(SCOPE, "x" * 64, BODY))["status"], 200)

    async def test_T13_question_length_boundaries(self):
        for length, expected in ((0, 400), (1, 200), (3999, 200), (4000, 200), (4001, 400)):
            with self.subTest(length=length):
                result = await self.api.post(SCOPE, f"key-{length}", {"question": "x" * length})
                self.assertEqual(result["status"], expected)
        self.assertEqual(self.repo.commits, 3)

    async def test_T14_invalid_payload_and_scope_do_not_write(self):
        invalid = [None, [], {}, {"question": 1}, {"question": "Q", "conversation_id": 7},
                   {"question": "Q", "include_personal_docs": "true"},
                   {"question": "Q", "unrecognized": True}]
        for payload in invalid:
            with self.subTest(payload=payload):
                self.assertEqual((await self.api.post(SCOPE, "key", payload))["status"], 400)
        for scope in ((), ("tenant", "user"), ("tenant", "", "course")):
            with self.subTest(scope=scope):
                self.assertEqual((await self.api.post(scope, "key", BODY))["status"], 400)
        self.assertEqual((self.backend.calls, self.repo.commits), (0, 0))

    async def test_T15_failure_before_commit_then_retry(self):
        self.backend.fail_next = True
        self.assertEqual((await self.api.post(SCOPE, "key", BODY))["status"], 503)
        self.assertEqual((self.repo.commits, len(self.repo.rows)), (0, 0))
        self.assertEqual((await self.api.post(SCOPE, "key", BODY))["status"], 200)
        self.assertEqual((self.backend.calls, self.repo.commits), (2, 1))

    async def test_T16_lost_response_replays_after_new_coordinator(self):
        lost = await self.service.execute(SCOPE, "key", BODY)
        fresh = IdempotencyCoordinator(self.repo, self.backend)
        replay = await fresh.execute(SCOPE, "key", BODY)
        self.assertEqual(replay, lost)
        self.assertEqual((self.backend.calls, self.repo.commits), (1, 1))

    async def test_T17_two_coordinators_share_unique_repository(self):
        other = IdempotencyCoordinator(self.repo, self.backend)
        results = await asyncio.gather(self.service.execute(SCOPE, "key", BODY),
                                       other.execute(SCOPE, "key", BODY))
        self.assertEqual(results[0], results[1])
        self.assertEqual((len(self.repo.rows), self.repo.commits), (1, 1))
        # Duplicate computation across processes is NOT promised away.
        self.assertEqual(self.backend.calls, 2)

    async def test_T18_cancelled_waiter_does_not_cancel_shared_work(self):
        self.backend.pause = True
        first = asyncio.create_task(self.service.execute(SCOPE, "key", BODY))
        await self.backend.entered.wait()
        second = asyncio.create_task(self.service.execute(SCOPE, "key", BODY))
        first.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await first
        self.backend.release.set()
        result = await second
        self.assertIn("message_id", result)
        self.assertEqual((self.backend.calls, self.repo.commits), (1, 1))

    async def test_T19_two_hundred_inflight_replays_commit_once(self):
        self.backend.pause = True
        requests = [asyncio.create_task(self.service.execute(SCOPE, "key", BODY)) for _ in range(200)]
        await self.backend.entered.wait()
        self.backend.release.set()
        results = await asyncio.gather(*requests)
        self.assertTrue(all(result == results[0] for result in results))
        self.assertEqual((self.backend.calls, self.repo.commits), (1, 1))

    async def test_T20_input_and_output_are_isolated_snapshots(self):
        self.backend.pause = True
        body = {"question": "original"}
        task = asyncio.create_task(self.service.execute(SCOPE, "key", body))
        await self.backend.entered.wait()
        body["question"] = "changed"
        self.backend.release.set()
        result = await task
        self.assertEqual(result["answer"], "original")
        result["citations"][0]["document_id"] = "tampered"
        replay = await self.service.execute(SCOPE, "key", {"question": "original"})
        self.assertEqual(replay["citations"][0]["document_id"], "synthetic-doc")
        self.assertEqual(self.repo.commits, 1)


def make_pairwise_test(row):
    async def check(self):
        self.assertEqual(uncovered_pairs(), [])  # Independently verifies the design.
        tenant, long_question, concurrent, personal_docs = row
        scope = (f"tenant-{tenant}", "user-A", "course-A")
        payload = {"question": "Q" * (4000 if long_question else 1),
                   "include_personal_docs": bool(personal_docs)}
        if concurrent:
            first, second = await asyncio.gather(self.api.post(scope, "key", payload),
                                                  self.api.post(scope, "key", payload))
        else:
            first = await self.api.post(scope, "key", payload)
            second = await self.api.post(scope, "key", payload)
        self.assertEqual(first["status"], 200)
        self.assertEqual(first, second)
        self.assertEqual((self.backend.calls, self.repo.commits), (1, 1))
    return check


for index, row in enumerate(ROWS, 1):
    setattr(IdempotencyTests, f"test_T{index:02}_pairwise_{''.join(map(str, row))}", make_pairwise_test(row))


def load_tests(loader, tests, pattern):
    cases = list(loader.loadTestsFromTestCase(IdempotencyTests))
    seed = os.environ.get("VT002_TEST_ORDER_SEED")
    if seed is not None:
        random.Random(int(seed)).shuffle(cases)
    return unittest.TestSuite(cases)


if __name__ == "__main__":
    unittest.main(verbosity=2)
