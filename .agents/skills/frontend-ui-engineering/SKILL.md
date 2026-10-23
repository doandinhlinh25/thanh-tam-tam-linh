---
name: frontend-ui-engineering
description: Build or review this project's visual components and pages for consistent design, responsive layout, accessible interaction, and complete UI states. Use for user-facing interface work; route API contracts, security, and test strategy to their specialist skills.
---

# Frontend UI Engineering

## Purpose and activation

Produce clear, consistent, accessible pages and components for the RAG assistant and future LMS. Use this skill for layout, visual hierarchy, component variants, navigation, responsive behavior, keyboard interaction, and UI states. For data contracts use `frontend-api-integration`; for test selection use `frontend-testing`. Do not use this skill as evidence that a design system or framework is already installed.

The [discovery report](../../../docs/engineering/frontend-skill-discovery.md) establishes that `apps/web/` is empty. React, Vite, and TypeScript are planned in the [frontend assignment](../../../docs/documents/assignments/01-frontend-Thanh.md); styling and component libraries are undecided. Inspect the current tree again at activation because this will change.

## Required inputs and inspection

- Read the request, user flows, acceptance criteria, design references, and affected page/component files. Read the pre-existing untracked `yeu_cau.md` only if it is present and the request concerns its admin screens; it is a request, not an implemented design system.
- Inspect existing tokens, typography, spacing, icons, navigation, component variants, and loading/empty/error/success/permission states. If the frontend is still empty, record the decisions needed for its first visual foundation without claiming conventions exist.
- Inspect actual responsive rules and accessibility tooling before naming breakpoints, CSS classes, or automated checks.

## Decision and execution

1. State the screen's job, primary action, content hierarchy, required states, and supported viewport/interaction conditions. Use supplied references or nearby product screens; extract useful structure while keeping this product's content and identity.
2. Reuse existing primitives and tokens when they exist. Add a token or variant only when multiple uses justify it. Keep components focused; use composition when it makes the interface easier to change. Separate remote-data handling from presentation where it reduces coupling.
3. Make layout respond to content, not only device widths. Start from the narrow layout when that fits the audience and content. Check narrow viewports, zoom, long titles, validation text, citation lists, tables, and touch targets. Choose breakpoints from observed layout failure, not a prescribed framework scale.
4. Use native elements for actions, links, headings, lists, forms, and dialogs. Ensure every control has an accessible name, visible focus, keyboard operation, and a programmatic error or status when needed. For modal dialogs, verify focus enters, remains appropriately contained, and returns to the opener; `open` on `<dialog>` alone does not implement that behavior. Respect reduced motion.
5. Render meaningful loading, empty, error, success, disabled, and permission states required by the feature. Keep the user's context and recoverable input when an operation fails. Avoid decorative patterns that obscure information hierarchy or replace realistic content.
6. Inspect the rendered result at representative narrow, medium, and wide widths and with keyboard navigation. Use a screen reader and an automated accessibility checker when available; report what was actually checked.

## Project conventions and quality gates

- No CSS framework, token file, component library, Storybook setup, or UI test command is currently present. Do not prescribe Tailwind classes or React Query hooks until adopted. Prefer the project design decisions established by the first frontend implementation.
- The current product scope is course-material RAG; lesson/progress screens are conditional on product and API decisions. Use `rag-chat-experience` or `lms-ui` for their domain behavior.
- Accept a UI change when all specified states are rendered, controls work by keyboard, focus is managed, text and status do not rely only on color, content remains usable at the chosen viewports and zoom, and actual code follows the established visual system. Check WCAG AA contrast for applicable text and controls (at least 4.5:1 for normal text and 3:1 for large text or essential non-text controls). Record any untested screen-reader or browser combinations rather than claiming a pass.

## Failure handling, output, and handoff

If there is no product visual direction, record a small set of explicit design decisions and proceed with a coherent baseline. If a required state depends on an unavailable API, use the feature workflow to document the dependency and avoid presenting mock data as live data. Report the changed UI files, design decisions, viewport/keyboard/a11y evidence, and remaining limitations. Hand contracts to `frontend-api-integration`, domain questions to `rag-chat-experience` or `lms-ui`, and verification needs to `frontend-testing`. Recommend the next highest-value missing variant or interaction after the requested UI is complete.
