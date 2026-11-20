# Brainstorm: course-scoped demo learning flow

## Problem statement

The frontend has role-based demo pages and fixture-backed course/document/chat behavior, but the course learning journey is fragmented and its AI states need a clearer contract-shaped presentation. The architecture reference `origin/Linh:docs/architecture/document.pdf` (SHA `9b7b910`) defines the target journey as student `My courses -> Chat with citations, history, feedback`, and lecturer course materials with upload states. It also labels the architecture as TO-BE, so this phase remains a bounded demo slice.

User-confirmed direction: continue improving the course-scoped demo/chat UX with fixtures.

## Goals and non-goals

Goals:

- Make the student course-scoped learning journey coherent across course selection, material context, chat, citations, history, and feedback.
- Model the important RAG result states distinctly: answered with citations, insufficient evidence without citations, and technical failure with recovery.
- Keep every fixture and adapter explicitly demo-only and ready to replace behind a future public API contract.
- Preserve tenant/course boundaries in the UI state model and make keyboard, narrow viewport, and long-content behavior usable.

Non-goals:

- No public API, gateway, session, CSRF, upload, ingestion worker, retrieval, LLM, or streaming integration.
- No claim that frontend role controls authorize access.
- No lessons, progress, enrollment, billing, notification, or full LMS expansion beyond the confirmed course-material RAG flow.

## Requirements

Confirmed:

- The user selected the fixture-backed course/chat UX direction.
- The reference architecture calls for role-aware screens: student My Courses and Chat with citations/history/feedback; lecturer Course Materials and upload progress/publish; admin and owner operational screens remain separate concerns.
- The reference explicitly requires upload states `uploading`, `queued`, `processing`, `ready`, and `failed`, and requires technical errors to remain distinct from “no evidence”.
- Current repository evidence says public Chat/Document routes and resource-specific frontend contracts are unavailable.

Proposed:

- Implement the first slice around student course workspace and chat, with citation drawer/detail, history selection, feedback, and recoverable demo errors.
- Use a typed local domain model and a demo adapter boundary; do not shape components around internal service routes.
- Add lecturer material state presentation only where it shares the same domain/status model; defer publish mutation and real upload.

Assumptions:

- Existing visual tokens/primitives and current seeded fixtures are the base for the new slice.
- The user will approve this plan before implementation begins.

## Options and trade-offs

1. **Course workspace first (recommended):** compose course context, chat, citations, history, feedback, and fixture state transitions in the existing React app. This gives the highest value for the confirmed RAG journey with low contract risk.
2. **Admin/lecturer dashboard first:** improve materials and evaluation surfaces. This aligns with the architecture personas but leaves the student AI journey incomplete and does not validate citation/error UX.
3. **API-shaped mock layer first:** build a broad mock client for all proposed endpoints. This creates more replaceable seams but risks encoding unapproved paths and DTOs while no public contract exists.

The recommendation is option 1. Option 2 wins only if the product priority changes to operational users. Option 3 should be introduced later, once the public contract is approved.

## Edge cases

- No enrolled course or no material context.
- Course switch while a draft or pending response exists; stale result must not appear under another course.
- Empty history and history load failure.
- Answered result with multiple long citations; citation metadata is displayed as inert data.
- Insufficient evidence with zero citations.
- Technical/provider/permission failure with retry and preserved draft.
- Duplicate submit while a demo response is pending.
- Malicious answer text, filenames, citation titles, and unsafe links.
- Narrow viewport, keyboard-only navigation, long course names, and reduced motion.

## Acceptance criteria

- AC1: A student can choose an assigned course and see the course context reflected in the chat surface.
- AC2: Empty, loading, answered, insufficient-evidence, technical-error, and recoverable-retry states are visibly distinct.
- AC3: An answered fixture renders only server-shaped fixture citations; insufficient evidence renders no citation; technical error is not presented as insufficient evidence.
- AC4: Citation detail opens and closes accessibly, preserves the originating message context, and does not create a privileged guessed download URL.
- AC5: Chat submission prevents duplicate demo submissions, preserves a recoverable draft, and supports retry without duplicating the message.
- AC6: History selection and course switching do not leak or reuse a prior course's fixture messages.
- AC7: Feedback controls are available only for answered messages, have accessible names, and show submitted/failed states.
- AC8: The critical flow works by keyboard and remains usable at narrow and wide representative viewports.
- AC9: Untrusted text and links remain inert; no session token or internal service credential is used by the browser.
- AC10: All visible demo data and unavailable live integration boundaries are labeled in the UI or supporting documentation.

## Unresolved decisions

- **Scope of lecturer material status in this phase:** recommended to include read-only fixture status cards only; defer publish and upload actions.
- **Visual validation environment:** recommended to run component tests/build and Playwright demo checks after dependencies are installed; backend integration remains blocked.
- **Live API timing:** recommended to keep API integration out of this phase until public routes, DTOs, cookie/CSRF, citation target, and error contracts are checked in.
