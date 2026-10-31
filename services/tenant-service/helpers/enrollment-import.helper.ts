import { EnrollmentStatus } from "../models/course-enrollment.model";

/** Số dòng tối đa của một lô; 500 dòng `{ userId }` vẫn nằm dưới giới hạn JSON 32 kB. */
export const MAX_IMPORT_ROWS = 500;

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

/** TODO(BT3): chưa triển khai — stub để test unit chạy và thất bại đúng lý do. */
export const extractCandidateUserIds = (_rows: unknown[]): string[] => [];

/** TODO(BT3): chưa triển khai — stub để test unit chạy và thất bại đúng lý do. */
export const planEnrollmentImport = (
  _rows: unknown[],
  _context: ImportContext
): { results: ImportRowResult[]; summary: ImportSummary } => ({
  results: [],
  summary: { total: 0, created: 0, reactivated: 0, skipped: 0, rejected: 0 }
});
