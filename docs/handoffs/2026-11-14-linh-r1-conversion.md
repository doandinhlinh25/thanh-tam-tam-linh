# Handoff: 2026-11-14-linh-r1-conversion

## Task

- Original request: tải nhánh Linh, thực hiện bộ prompt R1 trên nhánh mới, push GitHub và giữ nguyên nhánh Linh.
- Latest steering: kiểm tra thư mục prompt đã có chưa.
- Worktree: D:/SoftwareEngeering/linh-r1-work.
- Branch: feat/linh-r1-conversion-20261114, base 27e11a8.
- Owner: Codex.

## Approved decisions

| Date | Decision | Approved by | Source |
| --- | --- | --- | --- |
| 2026-11-14 | Read/clone Linh, work on a new branch, eventually push; do not modify Linh | User | Original request |
| 2026-11-14 | No implementation plan or data cutover approved yet | Not approved | R1 stage gates |

## Stage log

### SCOUT — 2026-11-14 — Codex

- Status: NEEDS DECISION for next stage; package location is now verified.
- Inputs: AGENTS.md; scout skill; workflow; coding conventions; package README, M01–M04; V4 relevant database ownership sections; actual Compose, env helper, JPA/SQL properties, scripts and P03 review.
- Evidence: [scout report](../reports/2026-11-14/2026-11-14-linh-r1-conversion-scout.md).
- Changed files: report and handoff only.
- Findings: runtime root shared by Auth/Tenant; Document still JPA/PostgreSQL; smoke checks use SQL and weak PDF/fake tenant fixture; env generation lives outside the listed whitelist.
- Tests: three JavaScript syntax checks PASS. All runtime/build/E2E tests NOT RUN in this fresh checkout.
- Next: select PLAN; settle whitelist and baseline before approving COOK.
- Production secrets, existing volumes, service behavior and remote branches were not changed.

### IMPLEMENT / TEST / REVIEW — 2026-11-14

User reiterated the full implementation and new-branch push request after SCOUT. Implemented M01–M03 in the stated scope, serially, without production cutover. PLAN scope is recorded in docs/plans/2026-11-14/linh-r1-conversion.md.

Evidence: 27 Node tests + build/typecheck PASS; 41 Java PASS / 1 Redis live SKIPPED; 3 own-DB checks and 6 read + 6 write cross-DB denials PASS; actual scoped Auth login and Tenant transaction HTTP 200. Docker Compose config PASS; full-stack U1–U7 NOT RUN.

Reports: corresponding -cook.md, -test.md and -review.md in docs/reports/2026-11-14. M04 requires live Docker evidence and independent review before acceptance/cutover. Source changes are ready for a review branch, not a production migration. Existing SQL data, remote Linh, and frozen features remain untouched.
