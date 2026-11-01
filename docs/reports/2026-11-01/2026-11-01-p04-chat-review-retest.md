# P04-chat — Independent security re-review — 2026-11-01

**Quyết định: APPROVE** cho bản vá P04 R0 trong worktree hiện tại. `P04-REV-F1`: **RESOLVED**. `P04-REV-F2`: **RESOLVED**. Không phát hiện finding blocking mới trong phạm vi approved plan. Đây không phải xác nhận public Chat đã sẵn sàng mở hoặc Document/RAG end-to-end đã hoạt động.

## Task, Git và phạm vi

- Task `P04-chat`, subtask `P04-REV-F1-F2-REVIEW`, stage `REVIEW`; branch `ai/p04-chat-r0-from-Linh`; worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p04-chat-r0`.
- HEAD và merge-base với `Linh`: `066baea8592f6f45e538272b947a3a2473c77305`. Toàn bộ P04 diff vẫn chưa commit. Trước REVIEW: 12 tracked file Chat đã sửa, không staged diff; untracked là plan/handoff/báo cáo P04. `git diff --stat`: 12 file, 699 insertions/278 deletions. Không thấy thay đổi code bất thường sau TEST-REV-F1-F2.
- Đã đọc `AGENTS.md`, workflow, coding conventions, Review skill, approved plan, handoff, toàn bộ báo cáo COOK/TEST/REVIEW lịch sử và hai báo cáo COOK/TEST mới. Đã đọc toàn bộ tracked diff P04 và kiểm tra untracked files; đối chiếu source thực tế, không chỉ kết luận của TEST.
- Source review: `app/api/controllers/chat_controller.py`, `app/integrations/retrieval_service/{http_client.py,exceptions.py}`, `app/ai/retrieval/{client.py,mapper.py}`, `app/domain/value_objects/evidence.py`, `app/ai/{context_builder.py,citation_validator.py,pipeline.py}`, API router/error handler, internal LLM controller/provider. Test review: `tests/contract/test_retrieval_contract.py`, `tests/integration/{test_chat_api.py,test_retrieval_client.py}`, `tests/unit/{test_chat_service.py,test_citation_validator.py,test_generate.py,test_llm_adapter.py}`.
- Chỉ 12 file Chat product/test trong diff; không sửa Auth/Tenant/Document, shared packages/contracts, gateway, database/migrations, frontend hoặc production config. REVIEW này chỉ ghi báo cáo và P04 handoff; không sửa code/tests.

## Hai finding cũ

| Finding | Trạng thái | Bằng chứng mã nguồn và tái hiện |
| --- | --- | --- |
| `P04-REV-F1` — page mutation | **RESOLVED** | `mapper.py:72–73` từ chối `pageTo < pageFrom` trước `Evidence.from_dict`; `to_domain` dùng `all(...)` nên một candidate sai làm hỏng toàn response. `evidence.py:103` giữ nguyên giá trị explicit 3→2 khi tạo trực tiếp, không biến thành 3→3; `citation_validator.py:169–170` từ chối citation đảo chiều. Probe HTTP list gồm valid + inverted trả 502 `RETRIEVAL_INVALID_RESPONSE`, LLM 0 call, marker upstream không lộ. Page 2→3 và 3→3 được giữ trong Evidence/JSON. |
| `P04-REV-F2` — integer precision/overflow | **RESOLVED** | `evidence.py:6–24` trả trực tiếp Python int dương, không qua float; context/citation dùng cùng parser. Probe HTTP JSON với `documentVersion=10**400`, page `9007199254740993`–`9007199254740994` giữ đúng trong Evidence/citation/Python JSON; không OverflowError. Mapper từ chối bool, float, null, string ở integer bắt buộc. `rg` không thấy `int(float(...))` trên bốn file của đường xử lý bắt buộc. |

Hai retrieval draft chỉ yêu cầu từng page là integer minimum 1; `contracts/openapi/chat.yaml:535–538` (draft) yêu cầu `ChatCitation.page_to >= page_from`. Việc từ chối candidate đảo chiều ở Chat boundary dựa trên output invariant này; không khẳng định Document upstream đã chấp nhận quy tắc đó. Mapper không tự sửa trang hoặc đặt giới hạn integer tối đa tùy ý.

## Security regression và acceptance criteria

| Kiểm tra / AC | Review result | Bằng chứng |
| --- | --- | --- |
| AC1 public Chat fail-closed, header spoof không có quyền | PASS | Route `ask_course_chat` luôn raise `UnauthorizedException` trước `answer_question`; không đọc `X-Tenant-Id`/`X-User-Id`, không fallback anonymous. Router/middleware khác không tạo đường gọi ChatService. ASGI tests và TEST security probes ghi 401/zero service call. |
| AC2 internal LLM Bearer | PASS | `llm_controller.py` dùng `secrets.compare_digest` trước `LLMService.generate`; hai test thiếu/sai token reviewer chạy lại PASS, provider không gọi. Không đổi policy trong diff. |
| AC3 evidence gate/citation | PASS | Pipeline vẫn trả `insufficient_evidence` không gọi LLM cho evidence rỗng/thấp; citation không khớp bị loại. Unit test reviewer chạy lại; direct invalid page citation giờ bị từ chối. |
| AC4 retrieval error/sensitive data | PASS | HTTP client trả mã riêng 403/429/503/504/5xx, thông điệp cố định; malformed 200/invalid candidate trả 502. Lỗi đi qua pipeline/error handler, không thành thiếu evidence; HTTP probe reviewer không lộ marker. Empty candidates vẫn `[]`. |
| AC5 phạm vi R0 | PASS | Không có route, Auth/Tenant integration, Document retrieval implementation, DB migration, shared contract hoặc nghiệp vụ V4 mới; chỉ Chat code/tests và artifact P04. |

Public Chat chuyển từ 200 sang 401 là thay đổi availability đã được approved plan yêu cầu. Nó cố ý khóa mọi caller đến khi có trusted identity/course authorization riêng. Việc test public 200 cũ được thay bằng 401/no-service test phù hợp hành vi hiện tại; không coi public serialization đã được kiểm thử end-to-end.

## Chất lượng tests và lệnh REVIEW thực chạy

- Test mới đi qua mapper thật và assert giá trị Evidence/JSON, không chỉ status; unit citation assert direct inverted bị từ chối và page lớn giữ đúng; integration dùng HTTPX MockTransport → `RetrievalClient` → pipeline/error handler, assert 502, không lộ marker và LLM 0 call. Test valid 2→3, 3→3, version 1/`9007199254740993`/`10**400`, mixed invalid và empty evidence đều có coverage. Mock vẫn không chứng minh Document upstream live.
- TEST độc lập trước ghi 134 unit + 73 contract + 33 integration + 1 evaluation = **241 test duy nhất PASS**, zero FAIL/ERROR/SKIP; aggregate 240 PASS. REVIEW không chạy lại 241 test vì không có code/test change sau TEST. Reviewer tự chạy lại các test trọng điểm và probe dưới đây.

| Lệnh / probe REVIEW | Exit | Kết quả |
| --- | ---: | --- |
| `.venv/Scripts/python.exe -m pytest -p no:cacheprovider tests/contract/test_retrieval_contract.py tests/unit/test_citation_validator.py tests/integration/test_retrieval_client.py tests/integration/test_chat_api.py -q` | 0 | 133 PASS, 0 FAIL/ERROR/SKIP |
| `.venv/Scripts/python.exe -m pytest -p no:cacheprovider` với sáu test chọn lọc Bearer, insufficient evidence, retrieval technical failure, provider timeout/rate limit | 0 | 6 PASS |
| Python reviewer probe: HTTP mixed valid+inverted; HTTP integer lớn→citation/JSON; direct Evidence 3→2 | 0 | 3/3 PASS |
| `git branch --show-current`, `git rev-parse HEAD`, `git merge-base HEAD Linh`, `git status --short`, `git diff --stat`, `git diff --name-only`, `git diff --cached --name-only`, `git ls-files --others --exclude-standard` | 0 | Đúng worktree/base, không staged/out-of-scope diff |
| `git diff --check` | 0 | Không whitespace error; Git cảnh báo LF→CRLF tương lai ở test Chat API |
| `rg 'int\\(float\\('` trên mapper/Evidence/context/citation | 1 | Không có match (exit 1 là kết quả tìm kiếm rỗng, không phải test FAIL) |

## Findings mới, dependency và rollback

**Không có finding implementation mới được xác nhận.** Các giới hạn sau là **non-blocking cho P04 R0** và phải được giữ trong handoff:

1. `document.v1.yaml`, `retrieval-evidence.yaml` và ChatCitation vẫn là draft; retrieval draft chưa ghi thứ tự page, ChatCitation draft có. Document owner cần thống nhất schema cuối và ACL trước tích hợp.
2. HTTP mocks/local TCP không chứng minh Document upstream thật hay two-tenant RAG E2E. Public Chat vẫn khóa tới khi Auth/Tenant cấp trusted identity/course authorization trong kế hoạch riêng.
3. Python int và Python JSON roundtrip giữ số lớn, nhưng JavaScript `Number` có thể mất chính xác trên `Number.MAX_SAFE_INTEGER`; consumer end-to-end chưa được xác minh. Không tuyên bố compatibility đó đã PASS.
4. `Evidence` vẫn giữ fallback legacy khi được gọi trực tiếp với malformed value; đường HTTP retrieval strict validate trước khi gọi. Không tìm thấy product route bypass mapper.

Nếu cần rollback, review và đảo riêng các hunk P04 trong worktree sau khi so sánh với trạng thái trước từng COOK; không reset/clean cả worktree. Giữ guard 401 nếu chỉ rollback retrieval, vì tháo guard sẽ tái mở lỗi spoofing. Không có migration/data rollback.

**APPROVE** P04 R0 diff hiện tại cho mục tiêu security hardening đã duyệt. Quyết định này không cho phép tự commit, push, merge, mở PR, triển khai hay mở public Chat; chủ dự án quyết định bước tiếp theo.
