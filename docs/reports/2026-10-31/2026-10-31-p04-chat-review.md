# P04-chat — Independent security REVIEW — 2026-11-01

**Quyết định: REQUEST CHANGES.** F1 schema validation chặn field thiếu/sai kiểu, nhưng đường chuyển từ candidate hợp lệ sang `Evidence` vẫn âm thầm đổi metadata. Đây là review trên toàn bộ diff P04 chưa commit; 231 test xanh của TEST-F1 không được dùng làm bằng chứng duy nhất.

## Git, phạm vi và tài liệu

- Task `P04-chat`, stage `REVIEW`, priority `P0-SEC`; branch `ai/p04-chat-r0-from-Linh`, worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p04-chat-r0`.
- HEAD và merge-base với `Linh`: `066baea8592f6f45e538272b947a3a2473c77305`; không có staged diff. Đã đọc toàn bộ `git diff` của tám file Chat và liệt kê các file chưa theo dõi. HEAD ở commit nền không che giấu bản vá chưa commit.
- Đã đọc `AGENTS.md`, workflow, coding conventions, review skill, approved P04 plan, handoff, bốn báo cáo COOK/TEST/COOK-F1/TEST-F1, hai OpenAPI draft và code liên quan ở controller, router, middleware, error handler, retrieval, pipeline, Evidence, LLM/citation.
- Tám file thay đổi đều thuộc `services/chat-service/**`; các file chưa theo dõi trong worktree là plan/handoff/báo cáo P04. Những báo cáo P07 có sẵn không bị sửa. Không có diff ở Auth, Tenant, Document, packages/contracts, gateway, database/migrations, frontend, secrets hay config production.

| File | Thay đổi P04 | Rủi ro | Review result |
| --- | --- | --- | --- |
| `app/api/controllers/chat_controller.py` | Luôn trả 401 thay cho identity lấy từ header/default | Gián đoạn public Chat có chủ đích | PASS bảo mật |
| `app/integrations/retrieval_service/http_client.py` | Phân loại 403/429/5xx/timeout; thông điệp lỗi cố định; kiểm tra envelope hẹp | Upstream thật chưa xác nhận | PASS trong phạm vi plan |
| `app/integrations/retrieval_service/exceptions.py` | Exception kỹ thuật có status/code riêng | Mapping API thay đổi | PASS |
| `app/ai/retrieval/mapper.py` | Strict candidate validation trước `Evidence.from_dict` | Downstream vẫn đổi metadata hợp lệ | **FINDING** |
| `tests/contract/test_retrieval_contract.py` | Thêm trường hợp thiếu/null/sai kiểu và valid mapping | Chỉ kiểm tra page tăng và version nhỏ | Coverage gap |
| `tests/integration/test_chat_api.py` | Thay public 200 bằng 401/no service call | Mất test public serialization (route cố ý khóa) | PASS; giới hạn có chủ đích |
| `tests/integration/test_retrieval_client.py` | HTTP mock, error leak, malformed 200 | Mock không chứng minh live Document | PASS trong ranh giới mock |
| `tests/unit/test_chat_service.py` | Retrieval technical propagation và no LLM khi evidence rỗng | Không chạm wiring thực | PASS trong unit |

## Findings

### P04-REV-F1 — MEDIUM — Blocker: page metadata hợp lệ bị sửa âm thầm

- **Loại:** Confirmed defect. **Vị trí:** `services/chat-service/app/ai/retrieval/mapper.py:72–85`, `app/domain/value_objects/evidence.py:82–92`, `contracts/openapi/document.v1.yaml:258–263`, `contracts/openapi/retrieval-evidence.yaml:242–248`.
- **Bằng chứng tái hiện:** candidate đầy đủ với `pageFrom=3`, `pageTo=2`, các field khác đúng kiểu và version/score hợp lệ, đi qua `RetrievalMapper.to_domain` không lỗi; `Evidence.page_to` thực tế bằng **3**. Draft chỉ quy định từng trang là integer minimum 1; không có ràng buộc `pageTo >= pageFrom`. `Evidence.__init__` dùng `max(self._page_from, int(float(raw_pto)))` sau khi mapper đã xác nhận candidate.
- **Expected / actual:** metadata hợp lệ theo draft phải được giữ đúng giá trị đã nhận, hoặc một quy tắc thứ tự trang cần được phê duyệt rõ rồi trả technical error. Hiện tại giá trị bị thay mà không báo lỗi. Điều này trái mục tiêu F1 không còn fallback âm thầm và yêu cầu candidate hợp lệ mapping đúng; citation/page range có thể sai provenance. Public Chat đang 401 nên chưa có đường lộ public hiện tại, nhưng lỗi phải được xử lý trước khi coi retrieval mapping P04 đạt.
- **Khuyến nghị:** trong lượt COOK riêng, xử lý ở đường Chat `Evidence`/mapper sao cho không tự sửa page metadata theo quy tắc chưa có trong contract; thêm regression cho trường hợp này và kiểm tra citation downstream. Không tự thay shared contract hoặc Document Service trong REVIEW.

### P04-REV-F2 — LOW — Blocker cùng nhóm F1: integer hợp lệ mất chính xác hoặc phát sinh OverflowError

- **Loại:** Confirmed defect. **Vị trí:** `services/chat-service/app/domain/value_objects/evidence.py:62–80`, được gọi từ `app/ai/retrieval/mapper.py:85`.
- **Bằng chứng tái hiện:** `documentVersion=9007199254740993` qua mapper thành `9007199254740992`; `documentVersion=10**400` đi qua candidate validator nhưng `Evidence.__init__` ném `OverflowError` tại `float(raw_ver)`. Draft chỉ quy định integer minimum 1, không quy định maximum.
- **Expected / actual:** integer được chấp nhận phải giữ nguyên hoặc, nếu hệ thống quyết định giới hạn, bị từ chối có kiểm soát trước khi tạo Evidence. Hiện tại version có thể sai hoặc lỗi chung 500; rủi ro thực tế thấp vì giá trị cực lớn và upstream chưa triển khai, nhưng vẫn phá vỡ lời khẳng định mapping đúng cho candidate được validator chấp nhận.
- **Khuyến nghị:** cùng lượt COOK, bỏ chuyển integer qua float ở đường dữ liệu đã được kiểm tra, hoặc bổ sung giới hạn có căn cứ hợp đồng/thiết kế; thêm test cho số trên ngưỡng chính xác của float. Không nới phạm vi sang upstream.

## Security, contract và test assessment

- **Public Chat:** route duy nhất gọi `ChatService.answer_question` luôn raise `UnauthorizedException` trước lời gọi service; không đọc tenant/user header hoặc fallback anonymous. Dependency override của test không thay được body guard. Router khác hiện là stub, không gọi ChatService. Middleware chỉ gắn request ID/log path, không cấp identity. 401 response dùng thông điệp cố định; không thấy lộ tenant/secret. Việc tất cả caller nhận 401 là thay đổi compatibility đã được duyệt.
- **Retrieval:** HTTP 403→403, 429→429, 503→503, 504/timeout→504, 5xx khác→500. Error body/exception text không được gắn vào public message/details; mapper lỗi 200 dùng 502. Pipeline không catch lỗi retrieval thành `insufficient_evidence`; malformed candidate trong danh sách khiến cả response bị từ chối trước khi LLM/citation chạy. Empty candidates vẫn là evidence rỗng hợp lệ. Chưa phát hiện đường fail-open hay leak qua error handler trong phạm vi code review/mocks.
- **LLM/RAG:** Bearer được so sánh bằng `secrets.compare_digest` trước `LLMService.generate`; test thiếu/sai token kiểm tra provider không gọi. Unit test có evidence gate, citation không hợp lệ, provider timeout/rate limit. Không có diff nghiệp vụ ở pipeline/provider. Không có căn cứ để tuyên bố kiểm tra ACL hai tenant end-to-end khi public Chat vẫn khóa và Document upstream chưa chạy.
- **Contract draft:** Hai candidate schema thống nhất về các field cốt lõi; bản snake thêm `source_type` enum và text minLength 1. Mapper hỗ trợ hai shape, chặn null/sai kiểu/bool/NaN/Infinity, không đặt score range. HTTP client chỉ bắt `successful=True` và `data.candidates` chứ chưa xác minh mọi metadata bắt buộc của full draft envelope (`requestId`, index/model version hoặc snake retriever version). Đây là ranh giới hẹp được approved plan nêu rõ, không được gọi là full draft conformance. HTTP mocks phù hợp với client hiện có; **khả năng tương thích với Document retrieval upstream thật chưa được chứng minh** và là dependency tích hợp, không là lỗi P04 R0.
- **Tests:** `TEST-F1` đã chạy 133 unit + 65 contract + 32 integration + 1 evaluation = 231 test duy nhất PASS. Reviewer đọc test mới/sửa: assertions 401/no service, safe error, malformed 502/no LLM và F1 missing/null/type đều có ý nghĩa; hai public 200 serialization tests bị thay do route được khóa chủ đích. Tuy nhiên `test_candidate_mapping_keeps_complete_document_values` chỉ dùng page 3–4, version 2, nên không phát hiện F1/F2. Mock API `/probe-malformed` là pipeline + error handler giả lập, không phải public route hay live Document. Reviewer chạy lại 96 test trọng điểm, vẫn PASS dù hai finding tái hiện được.

## Lệnh đã chạy và kết quả

| Lệnh / probe | Kết quả |
| --- | --- |
| `git status --short --branch`, `git rev-parse HEAD`, `git merge-base HEAD Linh`, `git diff --stat`, `git diff --cached --stat`, toàn bộ `git diff` tám file, liệt kê untracked | Đúng P04 worktree/branch/base; tám file Chat; không staged/out-of-scope diff |
| `.venv/Scripts/python.exe -m pytest -p no:cacheprovider tests/contract/test_retrieval_contract.py tests/integration/test_retrieval_client.py tests/integration/test_chat_api.py -q` | Exit 0, **96 passed** |
| Python trực tiếp `RetrievalMapper.to_domain` với page 3→2 và version `9007199254740993` | Exit 0; actual pageTo=3, version=9007199254740992; xác nhận F1/F2 |
| Python trực tiếp với version `10**400` | Probe exit 0; bắt được `OverflowError` từ mapping |
| `git diff --check` | Exit 0, không whitespace error; chỉ cảnh báo LF→CRLF tương lai ở test Chat API |

Không sửa production code hoặc test trong REVIEW. Báo cáo này và phần REVIEW trong handoff là artifact mới duy nhất của lượt này.

## Dependency và quyết định

Auth/Tenant phải cung cấp trusted identity/course authorization trong kế hoạch riêng trước khi mở public Chat. Document owner cần xác nhận endpoint, ACL và schema cuối; sau đó mới có thể thử nghiệm live two-tenant RAG. Những việc đó nằm ngoài P04 R0.

**REQUEST CHANGES:** giao một lượt COOK P04 riêng xử lý F1/F2 và thêm regression cho metadata được giữ đúng, rồi chạy lại TEST độc lập trước khi REVIEW lại. Không commit/merge hoặc mở public Chat dựa trên REVIEW này.
