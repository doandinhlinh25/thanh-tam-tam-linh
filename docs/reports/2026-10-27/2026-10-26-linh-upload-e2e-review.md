# Review — kế hoạch upload E2E sau sandbox

- Ngày: 2026-10-27
- Task: `2026-10-26-linh-upload-e2e`
- Quyết định: **REQUEST CHANGES**
- Phạm vi: diff chưa commit trên `Linh` tại `d8f9270`; review chỉ đọc mã triển khai, đối chiếu [kế hoạch](../../plans/2026-10-27/upload-e2e-after-sandbox.md), [Prompt 01](../../prompts/ai01/linh/01-upload-e2e.md) và [báo cáo Test](2026-10-26-linh-upload-e2e-test.md).

## Tóm tắt

Sandbox đã chạy và bài kiểm thử đã quan sát được HTTP, PostgreSQL, S3 và Redis trên dependency thật. Bốn bài test cấu hình chạy lại trong review đều đạt. Tuy nhiên, hai điều kiện cụ thể của ma trận U1/U6 chưa được script E2E kiểm chứng như báo cáo PASS. Đây là khoảng trống của bằng chứng kiểm thử, chưa phải bằng chứng Document Service có lỗi bảo mật.

## Findings

### Medium — Confirmed defect — U6 chưa kiểm tenant khác có thật

- **Location:** `scripts/sandbox-upload-e2e.mjs:198`; `scripts/sandbox-fixtures.mjs:84-124`.
- **Finding:** Header `X-Tenant-Id` giả luôn là `000000000000000000000000`. Fixture chỉ tạo một tenant/course, không có tenant khác mà user thử có thể mạo danh. U6 của Prompt 01 yêu cầu thử cả giá trị thuộc tenant khác.
- **Impact:** Kết quả U6 hiện chứng minh header giả vô hiệu và user header không thay thế danh tính trong ca đã chạy, nhưng chưa chứng minh ranh giới chéo tenant được nêu trong ma trận. AC3 chưa đủ bằng chứng cho toàn bộ U1–U7.
- **Evidence:** Lệnh `sandbox:upload-e2e` có các assertion ở dòng 199–216 nhưng không tạo/đọc một tenant ID khác. Báo cáo Test ghi U6 PASS toàn phần.
- **Recommendation:** Tạo hoặc xác nhận tenant thứ hai trong fixture cô lập, dùng ID đó trong U6, kiểm tra response cùng snapshot theo cả tenant/course nguồn và tenant đích; chạy lại U1–U7 và sửa kết luận báo cáo theo kết quả thật.

### Medium — Confirmed defect — PDF U1 không phải tệp PDF đọc được

- **Location:** `scripts/sandbox-upload-e2e.mjs:34-37`; cùng mẫu ở `scripts/sandbox-smoke.mjs:51-53`.
- **Finding:** Buffer bắt đầu bằng `%PDF-1.7` nhưng thiếu `startxref`, bảng xref và cây `/Pages`. Prompt 01 yêu cầu PDF nhỏ hợp lệ.
- **Impact:** U1 chỉ chứng minh upload chấp nhận chữ ký PDF và lưu đúng byte, chưa chứng minh nhận một PDF hợp lệ để worker xử lý sau này. Báo cáo cần mô tả chính xác giới hạn đó cho tới khi fixture được thay.
- **Evidence:** Đọc chính buffer bằng `pypdf.PdfReader(io.BytesIO(data))` gây `PdfReadError: startxref not found`. Mã Document hiện kiểm MIME, tên file và magic bytes; vì vậy 202 không xác nhận cú pháp PDF đầy đủ.
- **Recommendation:** Dùng fixture PDF text tối thiểu có thể mở và trích xuất trang bằng parser; U5 thay bytes bằng một PDF hợp lệ khác. Chạy lại bài E2E và cập nhật báo cáo.

### Low — Concern — Snapshot S3 và Redis có giới hạn khi dữ liệu tích lũy

- **Location:** `scripts/sandbox-upload-e2e.mjs:58-85`.
- **Finding:** S3 ListObjectsV2 chỉ đọc một trang, Redis `XRANGE - +` đọc toàn stream. Sau nhiều lượt chạy, danh sách S3 có thể vượt một trang và Redis ngày càng lớn.
- **Impact:** Tính lặp lại lâu dài có thể giảm hoặc so sánh delta sai khi dữ liệu thử tích lũy.
- **Evidence:** Không xử lý `IsTruncated`/continuation token; không lọc Redis bằng khoảng ID/run trước khi tải.
- **Recommendation:** Phân trang S3 hoặc giới hạn dữ liệu theo run; đọc Redis theo mốc phù hợp. Có thể xử lý trong cùng lượt sửa test.

## Phạm vi và tiêu chí nghiệm thu

| Tiêu chí | Review | Căn cứ |
| --- | --- | --- |
| AC1 — bootstrap/readiness | Đạt | `--nodb`, dual network, loopback ports và báo cáo chạy thật; config test 4/4 chạy lại. |
| AC2 — course và phiên thật | Đạt | Fixture tạo course, lecturer/student; báo cáo ghi allow/deny API thực. |
| AC3 — U1–U7 với dependency thật | **Chưa đủ** | Các ca chạy qua dependency thật, nhưng U6 thiếu tenant khác và U1 dùng PDF không hợp lệ theo yêu cầu gốc. |
| AC4 — build/test nền | Đạt theo bằng chứng Test | `npm run build`, `npm run typecheck`, `npm test` 22 Node và Maven 17 Java đã ghi trong Test; review chỉ chạy lại config test. |
| AC5 — bằng chứng và bí mật | Đạt trong phạm vi kiểm tra | `.env` và `.test-data` bị Git ignore; diff và báo cáo không chứa credential. README có lệnh chạy; sandbox đang giữ dữ liệu thử. |

Thay đổi ngoài danh sách file dự kiến trong plan gồm `.gitattributes`, mạng `access`, script E2E riêng và ký S3 query; chúng có lý do từ lỗi Docker/Windows đã ghi trong báo cáo Test. Diff của `s3-init.sh` rỗng ở dạng chuẩn hóa; `.gitattributes` đảm bảo LF khi checkout. Không thấy thay API/schema hoặc Auth/Tenant business code. Thay đổi khác của người dùng trong workspace không thuộc review này và được giữ nguyên.

## Đánh giá bằng chứng và rủi ro còn lại

- `node --test test/sandbox-config.test.js` chạy lại: 4/4 PASS. `git diff d8f9270...HEAD` rỗng; phần triển khai đang ở working tree và file mới chưa track, đã được đọc trực tiếp.
- Báo cáo Test ghi ba lượt U1–U7 và các check nền PASS. Review không chạy lại bài E2E vì review này chỉ đọc mã và hai thiếu sót của fixture đã được xác định bằng kiểm tra tĩnh/parser.
- Sandbox chỉ chứng minh gọi trực tiếp Document tới `QUEUED`; chưa có worker/READY/retrieval/Chat hoặc public gateway E2E. Hai advisories từ `npm ci` cần được phân loại riêng trước khi dùng ngoài sandbox.
- Review do cùng phiên làm việc với bước triển khai thực hiện; chưa phải kiểm tra bởi người độc lập.

## Quyết định và bước tiếp theo

**REQUEST CHANGES** vì AC3 và yêu cầu PDF hợp lệ/chống mạo danh chéo tenant của Prompt 01 chưa được kiểm đầy đủ. Quay lại `$cook` để sửa fixture và U6, sau đó `$test` chạy lại U1–U7 và cập nhật báo cáo; cuối cùng `$review` lại diff mới. Chưa đánh dấu checklist review trong plan là đạt, chưa commit/push/merge.
