# Handoff: 2026-10-26-linh-upload-e2e

## Task

- Task ID: `2026-10-26-linh-upload-e2e`
- Original request: “thực hiện công việc trong file docs\prompts\ai01\linh\01-upload-e2e.md”
- Branch / worktree: `Linh` at `fbc9c03`, `C:/Users/User/MyProjects/thanh-tam-tam-linh`
- Owner: Codex cho Scout; Linh cho phạm vi Document; Duy Tâm cho môi trường Auth/Tenant theo Prompt 01.

## Approved decisions

Kế hoạch `docs/plans/2026-10-27/upload-e2e-after-sandbox.md` được người dùng duyệt ngày 2026-10-27 với yêu cầu thực hiện và báo cáo kết quả trong `docs/reports/2026-10-27`.

## Stage log

### Scout — 2026-10-26 — Codex

- Status: `DONE`
- Inputs read: `AGENTS.md`, `docs/workflow/README.md`, `docs/prompts/ai01/linh/01-upload-e2e.md`, báo cáo Document/dự án ngày 2026-10-26, mã/contract/test và cấu hình Document/Auth/Tenant.
- Completed work and evidence: Báo cáo tại `docs/reports/2026-10-26/2026-10-26-linh-upload-e2e-scout.md`; Git HEAD `fbc9c03`; Docker daemon không kết nối được, ba file `.env` cần thiết không tồn tại.
- Files or modules affected: Chỉ thêm báo cáo Scout và handoff này; chưa sửa source, test hoặc cấu hình.
- Assumptions: Có thể cần môi trường cô lập ngoài Docker trên máy này; chưa xác minh.
- Open questions / decisions needed: Duy Tâm cung cấp cách dựng hạ tầng, course và hai phiên thử không lộ secret.
- Risks and blockers: Không có bằng chứng U1–U7 chạy với dependency thật; nhiều thay đổi chưa theo dõi của người khác cần giữ nguyên.
- Remaining work: Lập kế hoạch, xin duyệt, viết test/fixture, chạy U1–U7, lập báo cáo Prompt 01.
- Recommended next skill: `$plan` — ma trận nghiệm thu và phạm vi đã được Prompt 01 xác định.

### Tiền kiểm Prompt 01 — 2026-10-26 — Codex

- Status: `BLOCKED`
- Inputs read: Prompt 01 đã cập nhật quy tắc dừng, cấu hình/Compose hiện tại, báo cáo Scout và trạng thái Git.
- Completed work and evidence: Báo cáo `docs/reports/2026-10-26/2026-10-26-linh-prompt-01.md`; thiếu bàn giao P1 có thể chạy lại trong workspace, ba file `.env` không tồn tại và Docker daemon không kết nối được.
- Files or modules affected: Chỉ thêm báo cáo Prompt 01 và cập nhật handoff; không sửa mã hoặc test.
- Open questions / decisions needed: Duy Tâm bàn giao môi trường thử, service credential, course thật và cách tạo hai phiên có/không có quyền.
- Remaining work: Sau khi P1 hoàn thành, xác minh đầu vào rồi lập kế hoạch/test U1–U7 theo workflow; không tính ca nào PASS ở thời điểm này.

### Plan — 2026-10-27 — Codex

- Status: `APPROVED (by user, 2026-10-27)`.
- Inputs read: Prompt 01, Scout và báo cáo BLOCKED ngày 2026-10-26, review PR #6, mã Compose và script sandbox sau khi nhánh `Linh` được rebase lên `origin/main` tại `828b302`.
- Completed work and evidence: Kế hoạch tại `docs/plans/2026-10-27/upload-e2e-after-sandbox.md`. Docker Engine hiện đáp ứng nhưng sandbox chưa chạy, `.env` sandbox chưa có; `mongo-init` còn thiếu `--nodb`. Node build/typecheck và 17 test Document đạt; test sandbox thiếu `yaml` tại `node_modules`, platform test dừng trước khi chạy vì lỗi môi trường `uv_os_get_passwd ... ENOMEM`.
- Files or modules affected: Chỉ thêm kế hoạch và cập nhật handoff; chưa sửa source, test hoặc cấu hình trong giai đoạn Plan.
- Remaining work: Duyệt kế hoạch; sửa bootstrap MongoDB, chạy stack/fixtures/smoke, triển khai và chạy ma trận U1–U7, cập nhật báo cáo và kiểm tra lại.

### Cook — 2026-10-27 — Codex

- Status: `DONE` for T1–T4 in the approved plan.
- T1: `infrastructure/sandbox/compose.yaml` now runs `mongosh --nodb`; `test/sandbox-config.test.js` checks it. `npm ci`, config test 4/4 and `sandbox:check` passed.
- T2: first live startup exposed Windows CRLF in `s3-init.sh` and missing localhost bindings on an internal-only network. Added scoped `.gitattributes` with LF and a separate `access` network for Auth/Tenant/Document/S3; databases remain internal-only. Updated sandbox README and config test. Startup, fixtures and smoke passed.
- T3: added `scripts/sandbox-upload-e2e.mjs` and npm command, using real fixture sessions and run-scoped PostgreSQL/S3/Redis snapshots; extended S3 signing in `scripts/sandbox-smoke.mjs` for listing. U1–U7 passed three times on the same fixture.
- T4: report at `docs/reports/2026-10-27/2026-10-27-linh-prompt-01.md`; detailed evidence at `docs/reports/2026-10-27/2026-10-26-linh-upload-e2e-test.md`.
- Deviations: added `.gitattributes` for Windows shell compatibility and a dual-network sandbox layout after live Docker evidence showed published host ports absent on an internal-only network. Added a separate E2E script rather than enlarging the original smoke script. No Auth/Tenant business code, schema, or API changed.
- Existing user changes in `docs/documents/assignments/02-platform-saas-Duy-Tam.md`, other untracked docs and `output/` were left intact. No commit, push, or merge.

### Test — 2026-10-27 — Codex

- Overall status: `PASS` for the approved upload milestone; all AC1–AC5 verified in `docs/reports/2026-10-27/2026-10-26-linh-upload-e2e-test.md`.
- `npm run build`, `npm run typecheck`, `npm test` (22 Node tests), Document `.\\mvnw.cmd test` (17 Java tests), `sandbox:check`, `sandbox:fixtures`, `sandbox:smoke`, and three `sandbox:upload-e2e` runs passed.
- Initial failed startup attempts and their causes are recorded in the Test report. Docker image download was retried successfully. `npm ci` noted two dependency advisories outside this plan.
- Remaining limitations: sandbox is local and still running; no worker/READY/retrieval/Chat or public gateway E2E evidence. Independent `$review` has not been run.

### Review — 2026-10-27 — Codex

- Status: `REQUEST CHANGES`.
- Inputs read: approved plan, Prompt 01, actual working-tree diff and new E2E script, Test report, fixture and sandbox configuration.
- Evidence: `node --test test/sandbox-config.test.js` passed 4/4; parser rejected the current PDF buffer with `startxref not found`. Full findings: `docs/reports/2026-10-27/2026-10-26-linh-upload-e2e-review.md`.
- Findings: U6 uses an all-zero tenant ID instead of an ID from a real second tenant; U1's PDF buffer is not a structurally valid PDF. AC3 needs fresh evidence after both are corrected. S3 listing pagination and full Redis scan are a lower-priority repeatability concern.
- Remaining work: return to `$cook` for test fixture/U6 changes, rerun `$test`, then `$review`. No implementation file was changed during this review; no commit, push or merge.
