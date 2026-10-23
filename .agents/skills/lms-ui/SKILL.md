---
name: lms-ui
description: Design or implement course-scoped learning UI for the RAG assistant and its future LMS. Use for course selection, materials, and contract-backed learning flows; keep lessons, progress, enrollment, and role actions conditional on product and API decisions.
---

# LMS UI

## Purpose and activation

Use this skill for course navigation, course materials, and learning screens that grow from the RAG assistant into an LMS. Use [frontend-ui-engineering](../frontend-ui-engineering/SKILL.md) for component, responsive, and accessibility work. Use the chat specialist for answer and citation behavior. Do not use this skill to assume a full LMS exists or to implement backend course and enrollment logic.

## Inputs and inspection

- Read the [frontend discovery baseline](../../../docs/engineering/frontend-skill-discovery.md), [frontend assignment](../../../docs/documents/assignments/01-frontend-Thanh.md), [platform assignment](../../../docs/documents/assignments/02-platform-saas-Duy-Tam.md), and relevant sections of the [AI-01 handbook](<../../../docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2 (1).md>). Treat the handbook and the existing admin UI request as product inputs until reconciled with a contract.
- Inspect current `apps/web/` screens, routing, tests, checked-in OpenAPI files, handlers, and gateway routes. Trace how a verified session, tenant membership, course access, and document status reach the UI. Identify existing design and data-fetching patterns before adding any.
- Obtain the actor journeys, approved screen scope, role/permission rules, course/material contracts, and search/filter/sort/pagination semantics. Check whether lessons, paths, progress, enrollment status, or instructor/admin actions have both product approval and working contracts.

## Decisions and execution

1. Build from the confirmed capability: course selection and permitted course materials support the RAG workflow. Show only courses and actions returned as accessible by the authoritative service. A route parameter, browser-selected tenant, or hidden button is not authorization proof.
2. Define loading, empty, forbidden, expired-session, error, and success states for each screen. Preserve selected course only within the established session and routing model; clear stale course data after tenant or permission changes. Keep document ingestion labels and allowed actions tied to the actual contract.
3. Add course details, catalog search/filter/sort, lesson navigation, learning paths, progress indicators, enrollment, and role-specific management only when their semantics, permissions, and APIs are agreed. Do not derive progress or enrollment from local guesses, and do not invent endpoints or DTOs. Keep prototypes and mocks identified as such.
4. Compose screens with established frontend conventions. Make long course names, dense material lists, small screens, keyboard operation, and assistive-technology labels part of the implementation. Coordinate document upload/status behavior with the document contract rather than treating a display request as a backend guarantee.

## Verified conventions and gates

`apps/web/` is empty in the discovery baseline. Course selection and text-PDF materials are planned. A broader LMS with lessons, progress, paths, and enrollment UI is future scope; no functional frontend-facing course or document contract exists yet. The separate admin UI request asks for PDF/DOCX and different ingestion labels than the handbook, so resolve those differences during business analysis before implementation.

Accept the work when every visible course/action has a confirmed contract and role rule, tenant/course switches cannot show stale protected data, all required states are understandable, responsive and keyboard flows work, and search/filter/pagination reflect server semantics where applicable. Run supported frontend checks and state which were unavailable. If contracts or product rules are missing, provide a screen-to-contract gap and a bounded prototype instead of claiming live LMS behavior.

## Output, handoff, and next action

Deliver implemented screens, a screen/actor/API map, verification results, and explicit contract gaps. Hand course, enrollment, and role decisions to the platform owner; document status and upload decisions to the document owner; unresolved product scope to BA. Next, complete the course/material journey before expanding into lessons or progress, then verify access changes and cross-tenant denial end to end when services are available.
