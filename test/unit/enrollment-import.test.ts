import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMPORT_ROWS,
  extractCandidateUserIds,
  planEnrollmentImport
} from "../../services/tenant-service/helpers/enrollment-import.helper";

/**
 * Unit test cho bảng chuyển trạng thái import (BT3 VT-004, state transition testing).
 * Trạng thái enrollment của cặp (course, user): NONE | active | dropped | completed.
 * Guard: user có phải thành viên `student` đang active của tenant hay không.
 * Mỗi ID dưới đây đại diện cho đúng một (trạng thái, guard) để đọc lỗi dễ dàng.
 */
const id = (suffix: string) => suffix.padStart(24, "0");
const NONE_STUDENT = id("a1");
const DROPPED_STUDENT = id("a2");
const ACTIVE_STUDENT = id("a3");
const COMPLETED_STUDENT = id("a4");
const NONE_NOT_STUDENT = id("b1");
const DROPPED_REVOKED = id("b2");

const context = {
  activeStudentIds: new Set([NONE_STUDENT, DROPPED_STUDENT, ACTIVE_STUDENT, COMPLETED_STUDENT]),
  enrollmentStatusByUser: new Map([
    [DROPPED_STUDENT, "dropped" as const],
    [ACTIVE_STUDENT, "active" as const],
    [COMPLETED_STUDENT, "completed" as const],
    [DROPPED_REVOKED, "dropped" as const]
  ])
};
const rowsOf = (...userIds: unknown[]) => userIds.map((userId) => ({ userId }));
const outcomeOf = (userId: string) => planEnrollmentImport(rowsOf(userId), context).results[0];

test("U-ST1 NONE --import[student]--> active: created", () => {
  assert.deepEqual(outcomeOf(NONE_STUDENT), { row: 1, userId: NONE_STUDENT, outcome: "created" });
});

test("U-ST2 dropped --import[student]--> active: reactivated", () => {
  assert.deepEqual(outcomeOf(DROPPED_STUDENT), {
    row: 1,
    userId: DROPPED_STUDENT,
    outcome: "reactivated"
  });
});

test("U-ST3 active --import--> active: skipped, không ghi lại", () => {
  assert.deepEqual(outcomeOf(ACTIVE_STUDENT), {
    row: 1,
    userId: ACTIVE_STUDENT,
    outcome: "skipped",
    reason: "already_active"
  });
});

test("U-ST4 completed --import--> completed: transition bị cấm", () => {
  assert.deepEqual(outcomeOf(COMPLETED_STUDENT), {
    row: 1,
    userId: COMPLETED_STUDENT,
    outcome: "rejected",
    reason: "enrollment_completed"
  });
});

test("U-ST5 NONE --import[không phải student active]--> NONE: rejected", () => {
  assert.deepEqual(outcomeOf(NONE_NOT_STUDENT), {
    row: 1,
    userId: NONE_NOT_STUDENT,
    outcome: "rejected",
    reason: "not_active_student"
  });
});

test("U-ST6 dropped --import[member đã bị thu hồi]--> dropped: không hồi sinh quyền", () => {
  assert.deepEqual(outcomeOf(DROPPED_REVOKED), {
    row: 1,
    userId: DROPPED_REVOKED,
    outcome: "rejected",
    reason: "not_active_student"
  });
});

test("U-N1 (negative) dòng sai định dạng bị rejected, không throw", () => {
  const malformed = [
    null,
    42,
    {},
    { userId: "" },
    { userId: "abc" },
    { userId: id("1").slice(1) },
    { userId: id("1") + "0" },
    { userId: "z".repeat(24) },
    { userId: 123456789012345678901234 },
    "a".repeat(24)
  ];
  const plan = planEnrollmentImport(malformed, context);
  assert.equal(plan.results.length, malformed.length);
  plan.results.forEach((result, index) => {
    assert.deepEqual(result, {
      row: index + 1,
      userId: null,
      outcome: "rejected",
      reason: "invalid_user_id"
    });
  });
  assert.deepEqual(extractCandidateUserIds(malformed), []);
});

test("U-N2 (negative) trùng trong lô: lần đầu thắng, kể cả khác hoa/thường", () => {
  const upper = NONE_STUDENT.replace("a1", "A1");
  const plan = planEnrollmentImport(rowsOf(NONE_STUDENT, upper, NONE_STUDENT), context);
  assert.deepEqual(
    plan.results.map((result) => [result.outcome, result.reason]),
    [
      ["created", undefined],
      ["rejected", "duplicate_in_batch"],
      ["rejected", "duplicate_in_batch"]
    ]
  );
  assert.deepEqual(plan.results[1].userId, NONE_STUDENT);
  assert.deepEqual(extractCandidateUserIds(rowsOf(NONE_STUDENT, upper)), [NONE_STUDENT]);
});

test("U-INV dòng lỗi ở đầu/giữa/cuối không đổi outcome của dòng hợp lệ (invariant)", () => {
  const valid = [NONE_STUDENT, DROPPED_STUDENT, ACTIVE_STUDENT];
  const alone = planEnrollmentImport(rowsOf(...valid), context).results.map(
    ({ outcome, reason, userId }) => ({ outcome, reason, userId })
  );
  const layouts = [
    ["bad", NONE_STUDENT, DROPPED_STUDENT, ACTIVE_STUDENT],
    [NONE_STUDENT, null, DROPPED_STUDENT, NONE_NOT_STUDENT, ACTIVE_STUDENT],
    [NONE_STUDENT, DROPPED_STUDENT, ACTIVE_STUDENT, COMPLETED_STUDENT, "bad"]
  ];
  for (const layout of layouts) {
    const plan = planEnrollmentImport(rowsOf(...layout), context);
    const kept = plan.results
      .filter((result) => valid.includes(result.userId ?? ""))
      .map(({ outcome, reason, userId }) => ({ outcome, reason, userId }));
    assert.deepEqual(kept, alone, JSON.stringify(layout));
    assert.deepEqual(
      plan.results.map((result) => result.row),
      layout.map((_value, index) => index + 1)
    );
    const { total, created, reactivated, skipped, rejected } = plan.summary;
    assert.equal(total, layout.length);
    assert.equal(created + reactivated + skipped + rejected, total);
  }
});

test("U-SUM summary đếm đúng từng outcome và chỉ dòng created/reactivated là cần ghi", () => {
  const plan = planEnrollmentImport(
    rowsOf(
      NONE_STUDENT,
      DROPPED_STUDENT,
      ACTIVE_STUDENT,
      COMPLETED_STUDENT,
      NONE_NOT_STUDENT,
      "bad",
      NONE_STUDENT
    ),
    context
  );
  assert.deepEqual(plan.summary, {
    total: 7,
    created: 1,
    reactivated: 1,
    skipped: 1,
    rejected: 4
  });
  assert.equal(MAX_IMPORT_ROWS, 500);
});
