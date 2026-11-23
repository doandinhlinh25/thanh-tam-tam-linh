# P04-chat — TEST-REV-F1-F2 độc lập — 2026-11-01

**Kết luận: TEST_PASS.** Hai finding `P04-REV-F1` và `P04-REV-F2` đã được kiểm tra lại bằng probe độc lập, HTTP mocks và toàn bộ Pytest. Đây là TEST, không phải REVIEW hay chứng nhận live Document/RAG integration.

## Task, môi trường và Git

- Task `P04-chat`, subtask `P04-REV-F1-F2-RETEST`, stage `TEST`; branch `ai/p04-chat-r0-from-Linh`, worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p04-chat-r0`.
- HEAD và merge-base với `Linh`: `066baea8592f6f45e538272b947a3a2473c77305`. Trước và sau TEST đều có 12 file Chat product/test đã sửa từ các lượt COOK P04 và các artifact P04 chưa theo dõi; không có staged diff. Bản vá chưa commit được bảo toàn.
- Đã đọc `AGENTS.md`, workflow, coding conventions, test skill, approved plan, handoff, các báo cáo COOK/TEST lịch sử, Security REVIEW và báo cáo COOK-REV-F1-F2. Đã kiểm tra source và diff của mapper, Evidence, context/citation, HTTP client/controller cùng test liên quan, hai retrieval draft và ChatCitation draft.
- `.venv` cô lập: Python 3.13.5, pytest 8.4.2, httpx 0.28.1, pytest-asyncio 0.26.0. Không dùng production DB, token hay provider thật.

## F1 — page range integrity

| Input / đường kiểm tra | Actual | Kết quả |
| --- | --- | --- |
| `pageFrom=3,pageTo=2` | Mapper `RetrievalInvalidResponseException` 502; HTTP pipeline 502 `RETRIEVAL_INVALID_RESPONSE`; LLM 0 call | PASS |
| `3,3`; `2,3`; `1,1` | Evidence, citation, JSON giữ nguyên | PASS |
| `pageFrom=0`, `pageTo=null`, `pageFrom="3"` | Technical 502 trước Evidence | PASS |
| Một valid + một inverted candidate | Cả danh sách bị từ chối, không bỏ qua candidate lỗi | PASS |
| `Evidence.from_dict` trực tiếp với `3,2` | Giữ `3,2`, không sửa thành `3,3`; `CitationValidator` từ chối citation đảo chiều | PASS |
| HTTP malformed chứa marker nhạy cảm | Public error không chứa marker; LLM không gọi | PASS |

`contracts/openapi/document.v1.yaml` và `retrieval-evidence.yaml` chỉ ghi mỗi page là integer minimum 1; `contracts/openapi/chat.yaml:535–538` (draft) ghi `ChatCitation.page_to >= page_from`. Mapper áp dụng invariant citation khi nhận retrieval candidate, trả 502 thay vì tự sửa metadata. Đây là lựa chọn tương thích với output contract draft, nhưng cần thống nhất với Document owner khi hoàn thiện upstream contract.

## F2 — integer precision và overflow

| Input / đường kiểm tra | Actual | Kết quả |
| --- | --- | --- |
| `documentVersion=1` | Giữ 1 | PASS |
| `documentVersion=9007199254740993` | Giữ chính xác trong Evidence và Python JSON roundtrip | PASS |
| `documentVersion=10**400` | Giữ chính xác, không `OverflowError`, kể cả qua HTTP JSON mock | PASS |
| `pageFrom=9007199254740993`, `pageTo=9007199254740994` | Giữ chính xác qua HTTP JSON → Evidence → context → citation/JSON | PASS |
| Version `True`, `1.5`, `null`, `"123"` | Bị mapper từ chối 502 theo integer contract | PASS |

Không còn `int(float(...))` trong `mapper.py`, `evidence.py`, `context_builder.py` hoặc `citation_validator.py` (lệnh `rg` không tìm thấy). `Evidence` vẫn giữ fallback legacy khi được gọi trực tiếp với malformed value, nhưng đường retrieval HTTP strict validate trước khi tạo Evidence; không thấy input malformed đi qua thành Evidence hợp lệ. Probe trực tiếp **16/16 PASS**; HTTP JSON/pipeline **3/3 PASS**. JSON roundtrip tại Python giữ giá trị; **không** chứng minh JavaScript consumer giữ được integer trên `2^53-1`.

## Full P04 security regression

- Probe ASGI độc lập: public chat thiếu header, tenant-only, user-only, tenant+user đều 401 và không gọi `answer_question`; internal LLM thiếu/sai Bearer đều 401, provider 0 call.
- HTTP mock độc lập: upstream 403/429/500 giữ mã lỗi kỹ thuật tương ứng; exception không chứa marker upstream. Tổng probe security **9/9 PASS**.
- Pytest unit/contract/integration kiểm tra thêm malformed 200, evidence rỗng/thấp không gọi LLM, technical retrieval error không thành `insufficient_evidence`, citation validation, provider timeout/rate limit và valid evidence. Public chat vẫn fail-closed; không mở route để thử retrieval.
- Không có bằng chứng rò rỉ secret/token/tenant data qua các response đã kiểm tra. Mock HTTP và local tests không thay thế hai tenant end-to-end hoặc live Document integration.

## Pytest và Git evidence

Các lệnh sau chạy trong `services/chat-service` bằng `.venv/Scripts/python.exe` và `-p no:cacheprovider`. Mọi lệnh exit 0.

| Lệnh | PASS | FAIL | ERROR | SKIP |
| --- | ---: | ---: | ---: | ---: |
| `python -m pytest -p no:cacheprovider tests/unit -q` | 134 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/contract -q` | 73 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/integration -q` | 33 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/evaluation -q` | 1 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/unit tests/contract tests/integration -q` | 240 | 0 | 0 | 0 |

**241 test duy nhất PASS** trong bốn nhóm; lệnh tổng hợp chỉ chạy lại 240 test đầu, không cộng trùng. Khớp số lượng COOK dự kiến, tăng 10 so với TEST-F1 trước (231).

`git diff --check`: exit 0, không whitespace error (chỉ cảnh báo LF→CRLF tương lai ở `tests/integration/test_chat_api.py`). `git status --short`, `git diff --stat`, `git diff --name-only` và untracked listing xác nhận chỉ 12 file Chat product/test cộng artifact P04. TEST này chỉ tạo báo cáo và cập nhật handoff; không sửa production code, test files, Auth/Tenant/Document, shared contracts/packages, gateway, DB/migration, frontend, production config hay file task khác.

## Findings và giới hạn còn mở

Không còn finding implementation nghiêm trọng được xác nhận trong phạm vi hai bản vá hoặc P04 security regression đã kiểm tra. Hai retrieval schema và ChatCitation đều là **draft**; retrieval draft chưa ghi page order, còn ChatCitation draft có invariant đó. HTTP mocks chứng minh hành vi Chat client với payload giả lập, **không** chứng minh Document upstream chạy thật hoặc RAG end-to-end. Trusted Auth/Tenant course authorization vẫn là dependency riêng trước khi public Chat được mở. JavaScript consumer có thể mất độ chính xác với JSON integer vượt ngưỡng an toàn; chưa có bằng chứng tương thích end-to-end và không được tuyên bố là đã đạt.

**Đề xuất:** chủ dự án giao lượt REVIEW độc lập lại. Dừng tại TEST; không commit, push, merge, rebase hay PR.
