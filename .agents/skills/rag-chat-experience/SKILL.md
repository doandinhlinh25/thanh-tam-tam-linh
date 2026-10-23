---
name: rag-chat-experience
description: Build or revise the course-material RAG chat experience, including conversation UI, answer states, citations, and feedback. Use for frontend chat work; not for implementing retrieval, models, or backend chat contracts.
---

# RAG Chat Experience

## Purpose and activation

Use this skill for chat history, message composition and rendering, source attribution, feedback, and AI response states in the course-material assistant. For visual components and accessibility patterns, also use [frontend-ui-engineering](../frontend-ui-engineering/SKILL.md). Backend retrieval, citation generation, model evaluation, and unrelated generic UI work are outside this skill.

## Inputs and inspection

- Read the [frontend discovery baseline](../../../docs/engineering/frontend-skill-discovery.md), [frontend assignment](../../../docs/documents/assignments/01-frontend-Thanh.md), [chat assignment](../../../docs/documents/assignments/04-chat-rag-evaluation-Thanh-Tam.md), and relevant sections of the [AI-01 handbook](<../../../docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2 (1).md>). Treat handbook examples as proposals.
- Inspect the current `apps/web/` implementation, tests, checked-in OpenAPI contracts, service handlers, and Kong routes before using an API or naming a field. Trace the selected tenant/course, conversation ownership, request, response, citation, and feedback flow. Record what is implemented, mocked, and unresolved.
- Obtain the requested user journey, supported chat/history/feedback contract, response and error shapes, citation metadata, pagination rules, and any streaming or cancellation protocol. If these are missing, define the frontend contract dependency and keep any prototype visibly isolated from production integration.

## Decisions and execution

1. Define observable states for empty history, loading, draft, submitting, answered, insufficient evidence, technical error, and recoverable retry. Use the actual contract to distinguish results; never present a provider or network failure as insufficient evidence.
2. Keep a question tied to its selected course and conversation. Prevent duplicate submissions; preserve the draft after a recoverable failure. Load history and paginate only as the confirmed contract permits. Use optimistic messages only when their temporary state and reconciliation are explicit.
3. Render answer Markdown and code blocks through the project's established safe rendering path. Treat generated text, snippets, filenames, and URLs as untrusted. Make the answer visually distinct from server-provided sources; expose a citation only from validated response metadata, with a usable document/page/snippet target when supplied. Do not infer citations from model text.
4. Add streaming and cancellation only after a checked-in or working contract defines transport, event order, completion and error semantics, and abort behavior. Add retry only when duplicate-message and idempotency behavior are known. Without those contracts, use the supported request/response flow and a clear pending state.
5. Provide feedback controls only for messages and actions authorized by the confirmed contract. Keep keyboard access, focus behavior, announcements, narrow-screen layout, and long-content overflow usable.

## Verified conventions and gates

The repository currently has no frontend implementation or functional Chat API. The handbook proposes `answered` with server-backed citations and `insufficient_evidence` without citations; technical failures use the shared error envelope. Streaming is not contracted. Browser-selected tenant/course is context, not authorization proof. Confirm current behavior again before implementation.

Accept the work when supported states and permissions match the contract; citations open the correct authorized source/page, insufficient evidence has no fabricated source, technical errors remain distinct, duplicate submission and recoverable draft behavior work, untrusted content cannot execute, and the critical chat flow works by keyboard and at narrow widths. Run only checks the implemented frontend supports, and report exact commands and outcomes. If a required API, citation target, or error shape is absent, stop that integration at a documented boundary rather than inventing it.

## Output, handoff, and next action

Deliver the changed chat UI and focused verification evidence, plus a screen-to-contract map and any explicit mock or unavailable behavior. Hand missing Chat/citation/feedback decisions to the Chat owner and access or document-link decisions to the platform/document owners. Next, validate the lecturer upload → READY → student question → citation → feedback journey once those backend contracts and services exist.
