import { EnrollmentStatus } from "../models/course-enrollment.model";

/** Số dòng tối đa của một lô; 500 dòng `{ userId }` vẫn nằm dưới giới hạn JSON 32 kB. */
export const MAX_IMPORT_ROWS = 500;

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

export type ImportOutcome = "created" | "reactivated" | "skipped" | "rejected";
export type ImportReason =
  | "invalid_user_id"
  | "duplicate_in_batch"
  | "not_active_student"
  | "enrollment_completed"
  | "already_active";

export type ImportRowResult = {
  row: number;
  userId: string | null;
  outcome: ImportOutcome;
  reason?: ImportReason;
};

export type ImportSummary = {
  total: number;
  created: number;
  reactivated: number;
  skipped: number;
  rejected: number;
};

export type ImportContext = {
  activeStudentIds: ReadonlySet<string>;
  enrollmentStatusByUser: ReadonlyMap<string, EnrollmentStatus>;
};

/** Chuẩn hóa `userId` của một dòng; trả `null` khi dòng sai định dạng. */
const normalizeUserId = (row: unknown): string | null => {
  const userId = (row as { userId?: unknown } | null)?.userId;
  return typeof userId === "string" && OBJECT_ID_PATTERN.test(userId) ? userId.toLowerCase() : null;
};

/**
 * Lấy các `userId` hợp lệ, không trùng để service nạp membership/enrollment một lần.
 * @param rows Dữ liệu thô từ request.
 * @returns Danh sách ObjectId dạng chữ thường theo thứ tự xuất hiện đầu tiên.
 */
export const extractCandidateUserIds = (rows: unknown[]): string[] => [
  ...new Set(rows.map(normalizeUserId).filter((userId): userId is string => userId !== null))
];

/**
 * Phân loại từng dòng import theo bảng chuyển trạng thái enrollment.
 * Hàm thuần: không đọc DB, không throw với dòng lỗi, nên một dòng lỗi không thể làm
 * thay đổi outcome của dòng khác (trừ quy tắc trùng lặp: lần xuất hiện đầu tiên thắng).
 * @param rows Dữ liệu thô từ request, mỗi phần tử kỳ vọng `{ userId }`.
 * @param context Membership student đang active và trạng thái enrollment hiện có.
 * @returns Kết quả theo dòng (1-based) và tổng hợp số lượng.
 */
export const planEnrollmentImport = (rows: unknown[], context: ImportContext) => {
  const seen = new Set<string>();
  const results: ImportRowResult[] = rows.map((row, index): ImportRowResult => {
    const base = { row: index + 1, userId: normalizeUserId(row) };
    if (base.userId === null) return { ...base, outcome: "rejected", reason: "invalid_user_id" };
    if (seen.has(base.userId))
      return { ...base, outcome: "rejected", reason: "duplicate_in_batch" };
    seen.add(base.userId);
    if (!context.activeStudentIds.has(base.userId))
      return { ...base, outcome: "rejected", reason: "not_active_student" };
    const current = context.enrollmentStatusByUser.get(base.userId);
    if (current === "active") return { ...base, outcome: "skipped", reason: "already_active" };
    if (current === "completed")
      return { ...base, outcome: "rejected", reason: "enrollment_completed" };
    return { ...base, outcome: current === "dropped" ? "reactivated" : "created" };
  });
  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    reactivated: 0,
    skipped: 0,
    rejected: 0
  };
  for (const result of results) summary[result.outcome] += 1;
  return { results, summary };
};
