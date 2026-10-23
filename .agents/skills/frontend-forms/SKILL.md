---
name: frontend-forms
description: Build or revise accessible React forms with client and server validation, pending states, duplicate-submit prevention, and recoverable error handling. Use for login, upload, feedback, or other data-entry flows; use frontend-api-integration for transport and session contracts.
---

# Frontend Forms

## Purpose and activation

Use this skill when a user enters data and submits it in `apps/web/`, including auth, document upload, and feedback forms once their flows are contracted. Simple non-submitting controls belong with `frontend-ui-engineering`; request transport and auth belong with `frontend-api-integration`.

## Inputs and inspection

1. Read the requested actor, action, fields, accepted formats and limits, success result, permission rules, and failure cases. Inspect existing form components, validators, API client, tests, and the live `apps/web/` package before selecting a form library or pattern.
2. Verify field names, required rules, server error codes, and `fieldErrors` against checked-in contracts or working handlers. [The shared envelope](../../../packages/common/src/index.ts) defines `fieldErrors` as a string map, but not the keys for a particular form. [Frontend discovery](../../../docs/engineering/frontend-skill-discovery.md) records that functional Auth, upload, and feedback contracts do not yet exist.
3. Identify the UI states to present: untouched, editing, invalid, submitting, server rejected, recoverable transport failure, and success. Note whether a file selection, password, or other sensitive input needs special handling.

## Decisions and execution

- Use native form semantics: a `<form>`, associated visible labels, correct input types, a submit button, and keyboard operability. Add instructions and required indicators in text, not color alone. Connect each field error to its control with `aria-describedby`; mark invalid controls with `aria-invalid`. Make a submission-level error perceivable and move focus to an appropriate error or summary when needed. Keep messages understandable to screen readers.
- Validate client-side rules that are known and useful before sending. Treat server validation and permission decisions as authoritative. Map contracted `fieldErrors` to fields, and show unmatched errors at form level instead of discarding them. Do not infer upload limits, MIME support, quotas, or authorization from the handbook alone.
- Prevent duplicate writes while a request is pending. Give the submit action a clear pending state and an outcome that does not depend on color. Preserve user-entered values after recoverable validation or network failures; avoid logging sensitive values or persisting secrets outside the form. Reset or navigate only after confirmed success.
- Keep validation logic and field rendering consistent with existing frontend conventions. Extract reusable field primitives only when real forms share behavior. Route transport details, cancellation, and session handling through `frontend-api-integration`. For file upload, distinguish transfer progress from later ingestion status only if both are contracted.

## Quality gates

- With keyboard and a screen reader, every field has a name, errors are announced and linked to the right field, focus remains understandable, and the result of submission is clear. Test the form at narrow and wide widths with long errors where UI exists.
- Relevant interaction tests cover invalid input, server field errors, a general/transport error, pending duplicate submission, retained input on recoverable failure, and confirmed success. Add file-specific cases only when the upload contract is known. Run the frontend's configured typecheck, build, and relevant tests; report unavailable checks honestly.
- Review the final diff for hard-coded uncontracted business values, secret handling, and accidental changes outside the form flow.

## Failure handling, output, and next action

If a field rule, accepted file type, CSRF flow, or error mapping is unresolved, state the contract gap and keep the form from claiming production integration. An explicitly requested mock may be isolated for design review and labeled as such. Do not invent a validator or API dependency merely to fill the gap.

Deliver the form behavior and state map, field-to-error mapping, accessibility and test evidence, and open contract decisions. Hand API issues to `frontend-api-integration` and interaction or visual review to `frontend-ui-engineering`. Next, confirm the missing contract, then verify the form against the real server response.
