---
name: frontend-feature-workflow
description: Run Scout, BA, Analyze, Plan, Cook, and Test for a new frontend feature, integration, or substantial change in this RAG-to-LMS repository. Use for end-to-end delivery; keep small fixes proportionate.
---

# Frontend Feature Workflow

## Purpose and activation

Use this orchestrator for a new frontend feature, integration, or substantial change. The stages are ordered **Scout → BA → Analyze → Plan → Cook → Test**. A small fix may keep each artifact to a few lines, but it must still establish the relevant facts, expected behavior, implementation choice, and verification. The user's scoped implementation request authorizes Cook; ask only when an unresolved decision materially changes product behavior, risk, or scope.

Inputs: user request, applicable `AGENTS.md`, [discovery baseline](../../../docs/engineering/frontend-skill-discovery.md), current repository state, and any feature specification or design/API contract. Reinspect the code at use time; the baseline records an empty `apps/web/`, not a permanent condition. Use the [feature record](references/feature-record.md) when the change needs a durable multi-stage handoff.

## Stage handoffs

| Stage | Work and decision | Deliverable consumed by next stage |
| --- | --- | --- |
| **Scout** | Inspect branch, status, untracked files, relevant docs, source, routes, components, hooks, services, tests, reusable patterns, data flow, backend ownership, and current contract. Run a relevant baseline check when one exists. For substantial work, explicitly use [frontend-git-flow](../frontend-git-flow/SKILL.md) for branch preflight. | Concise facts, affected files, dependencies, risks, baseline results, unknowns. |
| **BA** | State user problem, goal, actors, permissions, journeys, normal and failure flows, loading/empty/error/success/disabled states, responsive/accessibility needs, and observable acceptance criteria. Mark assumptions and open decisions. | Feature specification and acceptance criteria. |
| **Analyze** | Compare suitable approaches against current architecture, contracts, UX, security, accessibility, performance, maintainability, complexity, and regression risk. Identify backend/data/infrastructure handoffs. | Recommended approach, alternatives, trade-offs. |
| **Plan** | List intended files/modules, ordered tasks, API/state changes, acceptance-criterion-to-check mapping, rollback consideration, and specialist skills to invoke. Keep scope proportionate. | Executable plan and verification criteria. |
| **Cook** | Read and follow the selected specialist `SKILL.md` files, implement within scope, preserve unrelated work, cover specified states and error paths, and add meaningful regression tests when behavior warrants them. | Working change, changed-file summary, limitations. |
| **Test** | Run available relevant format/lint/type/test/build checks, exercise critical interactions and contracted API behavior, inspect responsive/accessibility/security-sensitive paths, inspect diff, and mark each acceptance criterion passed, failed, or blocked. | Commands and observed results, acceptance status, risks, prioritized next step. |

Each stage reads the previous stage's deliverable. Revisit affected stages if requirements or contracts change materially. Do not silently assume an API exists. The current `contracts/openapi/common.yaml` has no paths; handbook endpoint examples are proposals. If backend work is needed, specify the owner, required contract, and unblock condition rather than modifying unrelated services. Isolate temporary mocks and label them as mocks.

## Specialist routing and execution

At Plan, choose the skills whose scope actually applies. Before Cook or Test, **open their files and apply their procedures**; listing their names in a plan is insufficient. Paths are relative to this skill:

- Structure and refactoring: [frontend-architecture](../frontend-architecture/SKILL.md).
- Visual design, responsive layout, accessible interaction: [frontend-ui-engineering](../frontend-ui-engineering/SKILL.md).
- API, session, authorization boundaries: [frontend-api-integration](../frontend-api-integration/SKILL.md).
- Input and validation: [frontend-forms](../frontend-forms/SKILL.md).
- RAG chat, citations, AI states: [rag-chat-experience](../rag-chat-experience/SKILL.md).
- Course and future LMS UI: [lms-ui](../lms-ui/SKILL.md).
- Security, performance, and test selection: [frontend-security](../frontend-security/SKILL.md), [frontend-performance](../frontend-performance/SKILL.md), [frontend-testing](../frontend-testing/SKILL.md) as relevant.
- Branching, commit, and integration: [frontend-git-flow](../frontend-git-flow/SKILL.md).

The current root `npm run build`, `npm run typecheck`, and `npm test` cover Node workspaces, not a frontend. Discover frontend commands from its actual package manifest once it exists. Never report a command as passed unless it ran and passed. Record baseline failures and blocked checks separately. Do not automatically commit, push, or open a PR.

## Quality gate, failure handling, and output

Before Cook, require sufficient Scout facts, testable BA criteria, a selected approach, and an ordered Plan. For a substantial frontend feature, also require a successfully verified dedicated branch from the intended main baseline. If Git preflight cannot establish that branch, continue independent BA/Analyze/Plan work but hold Cook until the baseline is resolved or the user explicitly chooses a different branch policy. If a material product decision is unresolved, complete independent work and request only that decision. If the planned implementation requires a material scope change, revisit BA/Analyze/Plan before changing direction. Before completion, require a Test report with individual acceptance outcomes and an inspected diff. Handoff contract gaps to the responsible backend owner and propose the next most valuable workflow or improvement, prioritized by blocking impact.
