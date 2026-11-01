# Plan: P04-chat R0 hardening

- Task ID: `2026-10-31-p04-chat`
- Status: `APPROVED` (by chủ dự án, 2026-10-31, P04-CHAT COOK instruction in conversation)
- Inputs: `docs/reports/2026-10-31/2026-10-31-p04-chat-scout.md`, `docs/handoffs/2026-10-31-p04-chat.md`, P04 prompt, V4 reference, `docs/architecture/chat-contract-decisions.md` (draft), `contracts/openapi/chat.yaml` (draft).
- Baseline: branch `Linh` at `066baea8592f6f45e538272b947a3a2473c77305`; `git log 066baea..HEAD --oneline` empty at planning time. `git diff -- services/chat-service` empty. Preserve all other tracked/untracked work.

## 1. Objective and background

Harden **existing** Chat endpoints and retrieval error handling without adding V4 features. P04 explicitly allows a fail-closed fix for the public chat identity flaw after an approved plan. Current `chat_controller.py:24–39` treats request headers as tenant/user identity and supplies defaults; `security.py` has no session verification. Keep internal LLM Bearer rejection and evidence/citation behavior demonstrably correct.

## 2. Scope and non-goals

- In scope: only code/tests under `services/chat-service/**`, plus this task's workflow artifacts. Existing `/api/v1/courses/{course_id}/chat`, `/internal/llm/generate`, retrieval client/mapper, and regression tests.
- Out of scope: Auth/Tenant integration, trusted principal creation, Document retrieval implementation, quota, chat persistence, new API routes, MongoDB migration, gateway/OPA changes, shared contracts, deployment. No changes outside the owner whitelist. Do not turn draft OpenAPI into an implementation claim.
- Public chat will intentionally deny all requests until a separately approved trusted auth integration exists. Direct, explicitly mocked service/pipeline tests may still verify existing serialization and RAG logic, but must not imply public authorization works.

## 3. Current-state findings

- **Verified:** `app/api/controllers/chat_controller.py:24–39` reads unverified `X-Tenant-Id` and `X-User-Id` and defaults to `default-tenant`/`anonymous-user`. `tests/integration/test_chat_api.py:17–94` expects public 200 even with spoof headers or no identity.
- **Verified:** `app/api/controllers/llm_controller.py:78–87` rejects missing/invalid Bearer before provider; `tests/unit/test_generate.py:30–47` checks 401 and zero provider calls.
- **Verified:** `app/ai/pipeline.py:127–241` retrieves, gates evidence, invokes LLM, validates citations. Existing unit tests use mocks; Document Service currently has no route found for the retrieval URL.
- **Verified:** `app/integrations/retrieval_service/http_client.py:77–81` maps all 4xx to exception status 400 and includes upstream `response.text` in message/details. `app/api/error_handlers.py` returns `AppBaseException.message/details` to clients. `app/ai/retrieval/mapper.py` can convert malformed 200 payload into an empty candidate list. `tests/contract/test_retrieval_contract.py` currently asserts several malformed/null shapes map to `[]`; those assertions require explicit revision if technical failures are separated from legitimate empty evidence.
- **Verified:** SCOUT baseline test command did not start: local Python 3.13 lacks `pytest`. **Unknown:** runtime deployment behavior and actual upstream retrieval contract; draft contracts are guidance, not proof.

## 4. Proposed design

1. At the existing public chat boundary, return a stable 401 before calling `ChatService` whenever no trusted server-authenticated context exists. In R0 no trusted context exists, so fail closed for every public call with a valid body, regardless of headers/cookies supplied by the client. Remove use of `X-Tenant-Id`, `X-User-Id`, `default-tenant`, `anonymous-user` as authorization inputs. Use the existing `UnauthorizedException`/`AppBaseException` handler. Do not implement `verify_session_token`, infer identity from request state, or introduce a fake trusted header. Retain internal pipeline/service logic for direct tests and later approved integration.
2. For the existing retrieval HTTP client, map upstream 403 and 429 to distinct technical exceptions with matching status, while preserving existing 400, 503, 504 and 5xx behavior. Return fixed, non-sensitive messages/details; never propagate raw upstream body, URL, credential, token or exception text to the public error envelope. If an upstream error envelope has a recognized safe code, map only the code, not its free-text message.
3. Define the narrow shape for a successful retrieval response already expected by the Chat client: a success envelope containing `data.candidates` as a list (empty list is valid). Malformed 200 JSON/shape raises a technical retrieval exception; it must not become `insufficient_evidence`. Preserve valid candidate mapping and the documented empty-list behavior. Tests asserting malformed/null shapes become empty evidence must be updated to reflect this distinction. This is client response validation only, not an assertion that Document upstream is implemented.
4. Keep evidence gate/citation rules and internal Bearer implementation unless tests expose a concrete defect. Add only missing regression cases for empty/low evidence (no LLM), unmatched citation (refusal), invalid Bearer (no provider), and retrieval technical failures. Do not refactor the whole pipeline or provider.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `services/chat-service/app/api/controllers/chat_controller.py` | Fail-closed existing public route; remove client-supplied identity/defaults as trust inputs | T1 |
| `services/chat-service/tests/integration/test_chat_api.py` | Replace public 200 assumptions with 401/no service call; describe mock-only behavior accurately | T1 |
| `services/chat-service/app/integrations/retrieval_service/http_client.py` | Safe 403/429/5xx mapping and response-shape failure | T2–T3 |
| `services/chat-service/app/integrations/retrieval_service/exceptions.py` | Specific 403/429 and invalid-response error types/codes, documented Python public classes | T2–T3 |
| `services/chat-service/app/ai/retrieval/mapper.py` | Reject malformed response shapes; preserve valid empty candidates | T3 |
| `services/chat-service/tests/integration/test_retrieval_client.py` | Mock HTTP regression for status, sanitized details, malformed 200 | T2–T3 |
| `services/chat-service/tests/contract/test_retrieval_contract.py` | Update malformed/null expectations and keep valid mapping checks | T3 |
| `services/chat-service/tests/unit/test_chat_service.py`, `tests/unit/test_generate.py` | Add only missing gate/citation/Bearer regression assertions if needed | T4 |
| `docs/handoffs/2026-10-31-p04-chat.md` | Stage result and evidence | T5 |

No changes planned to `app/core/security.py`, provider implementation, PostgreSQL models, root files, contracts or other services. New public Python classes/functions in affected files must have docstrings explaining behavior and applicable parameters/returns/exceptions; avoid unexplained literals and declarations inside loops per user guidance.

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T0 | At COOK start, recheck branch/HEAD, owner paths, and existing diffs; stop if conflicting Chat edits appeared. | None | `git status --short --branch`; `git diff -- services/chat-service`; `git log 066baea..HEAD --oneline` | Scope safe; stale findings rechecked | Approved plan |
| T1 | Fail-close public chat; adjust route tests for missing/spoofed identity, confirm zero service calls. | Controller, `test_chat_api.py` | `python -m pytest tests/integration/test_chat_api.py -q` | Valid requests return 401; spoof headers do not call service | T0 |
| T2 | Preserve status for upstream 403/429; sanitize retrieval error messages/details for all HTTP/network error paths. | HTTP client, exceptions, retrieval tests | `python -m pytest tests/integration/test_retrieval_client.py -q` | 403/429/503/504/5xx stay technical; no raw upstream text in public-safe exception fields | T0 |
| T3 | Treat malformed 200 response as technical failure and keep legitimate `candidates: []` empty. | HTTP client, mapper, integration/contract tests | `python -m pytest tests/contract/test_retrieval_contract.py tests/integration/test_retrieval_client.py -q` | Valid empty list maps to no evidence; malformed shape raises typed technical error | T2 |
| T4 | Verify existing Bearer, evidence gate and citation tests; add focused missing cases only. | `test_chat_service.py`, `test_generate.py` if needed | `python -m pytest tests/unit -q` | Wrong Bearer never calls provider; empty/low evidence never calls LLM; unmatched citation refused | T1–T3 |
| T5 | Record actual code diff and checks in P04 handoff. | P04 handoff only | `git diff --check`; `git status --short --branch` | No out-of-scope edits or whitespace errors | T1–T4 |

One owner executes T0–T5 sequentially; no parallel agent work or shared-file coordination needed. COOK stops after implementation, without starting TEST. No commit, push, merge, rebase or PR.

## 7. Dependencies and prerequisites

- COOK requires this plan changed to `Status: APPROVED` by the project owner after review. User's “plan” authorizes this drafting stage only.
- Tests require Chat Python dependencies including pytest. SCOUT found `No module named pytest`; COOK/TEST must report `NOT RUN` if the environment remains unavailable, not claim pass. Dependency installation, if needed, must respect sandbox/network approval.
- Auth/Tenant owners must later supply a trusted session and course authorization contract before public chat can be reopened; Document owner must implement/confirm retrieval endpoint and ACL. These are **future cross-team dependencies**, not blockers to R0 fail-closed hardening.
- The draft Chat and retrieval contracts are not a license to implement new routes or shared contract changes. If a fix truly needs another service/shared file, stop and hand off to the coordinator.

## 8. Testing and verification strategy

Run from `services/chat-service` with Python bytecode/cache disabled when feasible. Use focused commands per task, then at TEST stage run `python -m pytest tests/unit tests/contract tests/integration -q` and `python -m pytest tests/evaluation -q` if dependencies and permitted local socket access are available. Record command, count, PASS/FAIL/NOT RUN. Inspect actual diff and response behavior; mock retrieval/proxy is not end-to-end RAG.

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC1 | Valid public request without identity and with forged tenant/user headers returns 401; `ChatService.answer_question` not called | API integration via ASGI mock |
| AC2 | Missing/wrong Bearer returns 401 and fake provider call count remains zero | Existing/focused API unit |
| AC3 | Empty/low evidence returns `insufficient_evidence` with no LLM call; unmatched citation yields refusal and no citations | Pipeline unit |
| AC4 | Retrieval 403/429/503/504/5xx retains distinct technical status; response excludes raw upstream body/secret; malformed 200 is technical error, valid empty candidates remains empty | HTTP mock integration + mapper contract |
| AC5 | Entire diff stays in owner paths; no auth stub, upstream route, DB migration, draft contract promotion, or false E2E claim | Diff review, `git diff --check`, test descriptions |

## 9. Risks and mitigations

- **Availability change:** fail-closed denies even legitimate users until Auth/Tenant integration. This is the P04 security direction; communicate explicitly in handoff and release notes. Do not silently reopen using headers.
- **Error compatibility:** 403/429 mapping and malformed 200 handling differ from current responses. Keep changes limited to confirmed boundary defects with regression tests; do not conflate upstream 403 with user course authorization.
- **Secret exposure:** existing retrieval exception fields include `response.text`. Use stable error text and safe codes only; test with sensitive-looking upstream body and assert it is absent from API error fields.
- **Draft upstream contract:** a 200 envelope shape is inferred from existing client/tests, not a live Document service. Restrict validation to the shape already consumed and report this assumption.
- **Working tree/environment:** unrelated user files exist, and pytest is absent. Preserve unrelated files; if tests cannot run, mark NOT RUN and leave final verification to TEST.

## 10. Acceptance criteria

- [ ] AC1: Forged or missing public chat identity cannot reach `ChatService`; 401 fail-closed.
- [ ] AC2: Invalid/missing internal LLM Bearer yields 401 without provider call.
- [ ] AC3: Empty/low evidence skips LLM; unmatched citation is rejected without verified citations.
- [ ] AC4: Retrieval/LLM technical errors are not reported as `insufficient_evidence`; retrieval 403/429 and malformed 200 are distinguishable and do not leak upstream content.
- [ ] AC5: Only existing R0 behavior is hardened; tests state mock boundaries; no out-of-scope code, data, schema or shared-contract edits.

## 11. Rollback or recovery

If COOK regresses behavior, revert **only P04's own diff** in `services/chat-service/**` after comparing against the pre-COOK snapshot; do not reset the whole worktree or erase others' edits. Restore the original public route only as a reviewed rollback because doing so reintroduces spoofing; the safer recovery is to retain the fail-closed guard while rolling back unrelated retrieval changes. No DB/data migration or deployment is planned.

## 12. Completion checklist

- [ ] Plan explicitly approved before COOK; approval recorded in handoff.
- [ ] T0–T5 done or explicitly deferred with owner approval.
- [ ] AC1–AC5 verified by separate `$test` stage with command evidence.
- [ ] `$review` decision recorded.
- [ ] No docs/config/migrations outside P04 scope changed; P04 handoff updated.
- [ ] No commit/push/merge/PR without separate authorization.
