# P04-chat — COOK fixes for REVIEW F1/F2 — 2026-11-01

**Stage: COOK only.** Task `P04-chat`, subtask `P04-REV-F1-F2`; branch `ai/p04-chat-r0-from-Linh`; worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p04-chat-r0`. HEAD và merge-base với `Linh` đều là `066baea8592f6f45e538272b947a3a2473c77305`. Toàn bộ bản vá P04 trước đó vẫn chưa commit và được bảo toàn; không reset, stash, clean, commit, push, merge hay rebase.

## Căn cứ và root cause

- Đã đọc `AGENTS.md`, workflow guide, coding conventions, Cook skill, approved P04 plan, handoff, TEST-F1 và Security REVIEW. Trước sửa đã xác nhận branch/HEAD/merge-base, `git status`, `git diff --check`, worktree list và lịch sử 5 commit.
- `Evidence.__init__` dùng `int(float(...))` cho version/trang và `max(page_from, page_to)`: mất độ chính xác integer, có thể ném `OverflowError`, và tự sửa page range. `ContextBuilder` cùng `CitationValidator` cũng dùng float và tự ép trang cuối lên trang đầu.
- Hai retrieval draft (`document.v1.yaml`, `retrieval-evidence.yaml`) chỉ quy định page là integer minimum 1. Nhưng `contracts/openapi/chat.yaml` phần `ChatCitation.page_to` ghi rõ phải `>= page_from`. Do đó candidate 3→2 không thể đi vào citation hợp lệ. Phương án: **từ chối rõ ràng ở mapper bằng `RetrievalInvalidResponseException`/HTTP 502**, trước LLM; không sửa thành 3→3. `Evidence` trực tiếp giữ nguyên 3→2 để không che giấu dữ liệu, còn `CitationValidator` từ chối nếu caller trực tiếp chuyển Evidence đảo chiều. Không sửa shared contracts.
- Python integer hợp lệ giờ được giữ nguyên, không đi qua float. Đường legacy chỉ dùng `Decimal` cho đầu vào không phải integer, xác nhận số nguyên dương trước khi chuyển; fallback cũ cho đầu vào malformed trực tiếp vẫn giữ để không phá compatibility. Candidate retrieval malformed vẫn bị mapper chặn trước, nên fallback legacy không hợp thức hóa response upstream sai schema.

## File đã sửa trong lượt này

| File / dòng chính | Finding | Thay đổi | Bằng chứng |
| --- | --- | --- | --- |
| `services/chat-service/app/domain/value_objects/evidence.py:6,83–103` | F1/F2 | `parse_positive_integer` giữ Python int chính xác; bỏ float và `max(page_from, page_to)` âm thầm | Contract test version/trang lớn; unit citation |
| `services/chat-service/app/ai/retrieval/mapper.py:18–26,49–73` | F1 | Từ chối page range đảo chiều ở cả camel/snake trước `Evidence.from_dict`; giữ F1 strict validation cũ | Contract 3→2; integration 502/no LLM |
| `services/chat-service/app/ai/citation_validator.py:10,153–170` | F1/F2 | Không chuẩn hóa trang đảo chiều; giữ integer lớn, từ chối citation range sai | Unit citation và JSON roundtrip |
| `services/chat-service/app/ai/context_builder.py:3,30–31` | F2 | Context không làm tròn trang lớn và không tự sửa page range | Contract test kiểm tra chuỗi context |
| `services/chat-service/tests/unit/test_citation_validator.py:175–226` | F1/F2 | Test direct Evidence đảo chiều bị từ chối; snippet fallback vẫn được kiểm tra trên range hợp lệ; page lớn chính xác trong citation/JSON | Unit PASS |
| `services/chat-service/tests/contract/test_retrieval_contract.py:253–299` | F1/F2 | Test 2→3, 3→3, 3→2 (camel/snake), version 1, `9007199254740993`, `10**400`, page lớn, Evidence/JSON/context | Contract PASS |
| `services/chat-service/tests/integration/test_retrieval_client.py:328–367` | F1 | HTTP mock thêm candidate 3→2, trả safe 502, không lộ marker, không gọi LLM | Integration PASS |

`documentVersion=True` và `1.5` tiếp tục bị strict mapper từ chối bởi regression F1 trước đó; valid empty candidates và valid full candidate vẫn được kiểm tra. Không thay test để cho phép dữ liệu sai; test cũ từng giả định citation sẽ sửa 8→3 thành 8→8 được thay bằng assertion từ chối có căn cứ ở ChatCitation draft, còn snippet fallback được giữ trong test range hợp lệ.

## Kiểm thử COOK thực chạy

Chạy từ `services/chat-service` bằng `.venv/Scripts/python.exe`, dùng `-p no:cacheprovider`. Sau chỉnh sửa cuối cùng đã chạy lại lệnh tổng hợp và evaluation. Exit code của tất cả lệnh dưới đây là 0.

| Lệnh | PASS | FAIL | ERROR | SKIP |
| --- | ---: | ---: | ---: | ---: |
| `python -m pytest -p no:cacheprovider tests/unit -q` | 134 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/contract -q` | 73 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/integration -q` | 33 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/evaluation -q` | 1 | 0 | 0 | 0 |
| `python -m pytest -p no:cacheprovider tests/unit tests/contract tests/integration -q` sau sửa cuối | 240 | 0 | 0 | 0 |

**241 test duy nhất PASS**, gồm 231 test baseline và 10 regression cases mới. Lệnh tổng hợp 240 chỉ chạy lại ba nhóm đầu, không cộng lặp vào tổng duy nhất. Bản vá trước đó vẫn được kiểm tra qua các suite: public chat 401 và header spoofing, internal Bearer 401/no provider, retrieval 403/429/5xx và safe messages, malformed 200, empty evidence, evidence gate, citation và provider timeout/rate limit. Đây là kiểm tra trong COOK, chưa thay lượt TEST độc lập.

`git diff --check`: exit 0, không có whitespace error; Git chỉ cảnh báo LF→CRLF tương lai ở test Chat API cũ. `git diff --stat` sau sửa cho thấy 12 file Chat thay đổi tính từ base; trong lượt F1/F2 này chỉ bảy file nêu trên được sửa. Không có staged diff hay sửa ngoài Chat/artifact P04. Không đổi Auth, Tenant, Document, shared contracts, gateway, frontend, database hoặc production config.

## Rủi ro, dependency và rollback

- Retrieval draft vẫn cho phép 3→2, trong khi ChatCitation draft yêu cầu thứ tự trang. Từ chối 502 bảo toàn tính đúng đắn của citation nhưng có thể làm lộ mâu thuẫn khi upstream thật được tích hợp; owner của hai contract cần thống nhất ở kế hoạch tích hợp riêng. Không tuyên bố live Document/RAG compatibility.
- Fallback legacy của `Evidence` khi được gọi trực tiếp với malformed value vẫn tồn tại cho compatibility; đường HTTP retrieval đã strict validate trước khi gọi. Python JSON roundtrip giữ số nguyên lớn, nhưng khả năng biểu diễn an toàn của client JavaScript hoặc schema cuối chưa được xác nhận.
- Public Chat tiếp tục fail-closed đến khi Auth/Tenant cung cấp trusted identity và course authorization riêng.
- Rollback riêng lượt này: review rồi chỉ đảo các hunk F1/F2 trong bốn source và ba test file ở bảng, giữ nguyên mọi hunk COOK/F1 P04 trước đó cùng toàn bộ artifact; không reset cả worktree. Rollback sẽ khôi phục lỗi page mutation/integer precision, vì vậy không nên chấp nhận P04 dựa trên trạng thái đó.

**Bước kế tiếp đề xuất:** một lượt TEST độc lập cho diff mới, sau đó REVIEW lại theo quyết định chủ dự án. Dừng tại COOK.
