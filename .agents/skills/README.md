# Project frontend skills

These skills are scoped to this repository. The [discovery report](../../docs/engineering/frontend-skill-discovery.md) separates implemented code from planned React/Vite/TypeScript and RAG/LMS behavior. Inspect the live tree and contracts each time a skill is used.

| Skill | Use when |
| --- | --- |
| [frontend-feature-workflow](frontend-feature-workflow/SKILL.md) | Delivering a new frontend feature, integration, or substantial change through Scout, BA, Analyze, Plan, Cook, Test. |
| [frontend-git-flow](frontend-git-flow/SKILL.md) | Preparing a verified-main feature branch or an authorized commit/PR handoff. |
| [frontend-architecture](frontend-architecture/SKILL.md) | Establishing modules, component/state boundaries, or a meaningful refactor. |
| [frontend-ui-engineering](frontend-ui-engineering/SKILL.md) | Building visual components, responsive layouts, accessible interactions, and complete UI states. This revises the pre-existing project skill. |
| [frontend-api-integration](frontend-api-integration/SKILL.md) | Integrating contracted gateway APIs, sessions, errors, cache scope, and request lifecycle. |
| [frontend-forms](frontend-forms/SKILL.md) | Implementing accessible data entry, validation, pending states, and recoverable submission. |
| [rag-chat-experience](rag-chat-experience/SKILL.md) | Implementing course-material chat, citations, feedback, and AI response states after contract checks. |
| [lms-ui](lms-ui/SKILL.md) | Building course UI now, or future lessons/progress/enrollment only after product and API decisions. |
| [frontend-security](frontend-security/SKILL.md) | Handling browser session boundaries, untrusted AI/document content, tenant data, files, or links. |
| [frontend-performance](frontend-performance/SKILL.md) | Diagnosing a measured slow browser flow or a defined large-data performance requirement. |
| [frontend-testing](frontend-testing/SKILL.md) | Selecting and executing meaningful frontend regression and acceptance checks. |

## General workflow skills

These six stage skills apply to any task in the repository: backend, infrastructure, docs, or frontend. The [workflow guide](../../docs/workflow/README.md) has the diagram, artifact paths, and templates. For frontend features, `frontend-feature-workflow` still defines the stage content. Its BA and Analyze stages correspond to `brainstorm`, and `review` follows its Test stage.

| Skill | Use when |
| --- | --- |
| [scout](scout/SKILL.md) | Read-only investigation before any change. |
| [brainstorm](brainstorm/SKILL.md) | Requirements, compared options, and acceptance criteria for approval. |
| [plan](plan/SKILL.md) | An ordered, verifiable plan in `docs/plans/YYYY-MM-DD/` that needs approval. |
| [cook](cook/SKILL.md) | Implementing an approved plan within its scope. |
| [test](test/SKILL.md) | Evidence-based verification against acceptance criteria. |
| [review](review/SKILL.md) | An independent review of the diff, ending in an accept or change decision. |

## Codex discovery and invocation

The [official Codex skill guide](https://learn.chatgpt.com/docs/build-skills) says Codex scans `.agents/skills` from the working directory to the repository root. The pre-existing `frontend-ui-engineering` skill was listed as available in this session, verifying this location for the runtime. Each directory above has a `SKILL.md` with `name` and `description`. Codex uses those fields to select a skill, then reads its body when used. In Codex CLI or the IDE extension, invoke explicitly with `$frontend-feature-workflow` (or another listed name); `/skills` shows available skills. For the orchestrator, open and follow the selected specialist files at Cook or Test, as the workflow requires. If a newly added skill does not appear in the selector, restart Codex and check its metadata and path.

The root [AGENTS.md](../../AGENTS.md) provides persistent repository guidance; it is not a substitute for the specialist instructions. The index is for people and navigation, not an additional skill. These files do not install Claude Code skills. No project `CLAUDE.md` or `.claude/skills` was found, so any Claude integration needs separate setup and validation.

## Current limits

`apps/web/` has no source or frontend commands, and `contracts/openapi/common.yaml` has no paths. Product assignments are inputs for future implementation, not evidence of deployed behavior. The [validation report](../../docs/engineering/frontend-skill-validation.md) records which skill checks ran and what cannot yet be exercised.
