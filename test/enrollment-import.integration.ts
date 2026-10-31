import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startHarness, Harness, Session } from "./support/platform-harness";

/**
 * Integration/API test cho import ghi danh hàng loạt (BT3 VT-004).
 * Chạy qua HTTP thật: Origin + cookie JWT + CSRF → Tenant → Auth → MongoDB replica set.
 * Mỗi test seed tenant riêng nên không phụ thuộc thứ tự chạy.
 */
let harness: Harness;
let ownerId: mongoose.Types.ObjectId;
let owner: Session;

before(
  async () => {
    harness = await startHarness();
    ownerId = await harness.createAccount("owner");
    owner = await harness.login(ownerId);
  },
  { timeout: 90000 }
);

after(async () => {
  await harness?.stop();
});

const ids = (count: number) => Array.from({ length: count }, () => new mongoose.Types.ObjectId());
const importPath = (tenantId: unknown, courseId: unknown) =>
  "/admin/tenant/" + tenantId + "/courses/" + courseId + "/enroll/import";
const rowsOf = (...userIds: unknown[]) => userIds.map((userId) => ({ userId: String(userId) }));
const enrollments = (courseId: mongoose.Types.ObjectId) =>
  harness.tenantDb.collection("course_enrollments").find({ courseId }).toArray();
const statusMap = async (courseId: mongoose.Types.ObjectId) =>
  Object.fromEntries(
    (await enrollments(courseId)).map((item) => [String(item.userId), item.status])
  );

/** Tenant có 1 course, `students` thành viên student active và 1 lecturer. */
const setup = async (students = 3) => {
  const { tenantId, courseIds } = await harness.seedTenant({ ownerId });
  const studentIds = ids(students);
  const lecturerId = ids(1)[0];
  await harness.addMembers(tenantId, studentIds, "student");
  await harness.addMembers(tenantId, [lecturerId], "lecturer");
  return { tenantId, courseId: courseIds[0], studentIds, lecturerId };
};

test("IT-01 (AC1, AC2) lô hỗn hợp: dòng lỗi không làm mất dòng hợp lệ", async () => {
  const { tenantId, courseId, studentIds, lecturerId } = await setup(3);
  const outsider = ids(1)[0];
  const [s1, s2, s3] = studentIds;
  const rows = [
    { userId: "not-an-object-id" },
    ...rowsOf(s1, outsider, lecturerId, s2, s1),
    null,
    ...rowsOf(s3)
  ];
  const result = await harness.request("POST", importPath(tenantId, courseId), { rows }, owner);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(
    result.body.results.map((item: any) => [item.row, item.outcome, item.reason ?? null]),
    [
      [1, "rejected", "invalid_user_id"],
      [2, "created", null],
      [3, "rejected", "not_active_student"],
      [4, "rejected", "not_active_student"],
      [5, "created", null],
      [6, "rejected", "duplicate_in_batch"],
      [7, "rejected", "invalid_user_id"],
      [8, "created", null]
    ]
  );
  assert.deepEqual(result.body.summary, {
    total: 8,
    created: 3,
    reactivated: 0,
    skipped: 0,
    rejected: 5
  });
  assert.deepEqual(await statusMap(courseId), {
    [String(s1)]: "active",
    [String(s2)]: "active",
    [String(s3)]: "active"
  });
});

test("IT-02 (AC3) chuỗi chuyển trạng thái trên DB thật, idempotent khi gửi lại", async () => {
  const { tenantId, courseId, studentIds } = await setup(4);
  const [fresh, dropped, active, completed] = studentIds;
  const longAgo = new Date("2026-01-01T00:00:00.000Z");
  const completedAt = new Date("2026-06-01T00:00:00.000Z");
  await harness.tenantDb.collection("course_enrollments").insertMany([
    {
      tenantId,
      courseId,
      userId: dropped,
      status: "dropped",
      enrolledAt: longAgo,
      completedAt: null
    },
    {
      tenantId,
      courseId,
      userId: active,
      status: "active",
      enrolledAt: longAgo,
      completedAt: null
    },
    { tenantId, courseId, userId: completed, status: "completed", enrolledAt: longAgo, completedAt }
  ]);
  const rows = rowsOf(fresh, dropped, active, completed);
  const first = await harness.request("POST", importPath(tenantId, courseId), { rows }, owner);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(
    first.body.results.map((item: any) => item.outcome),
    ["created", "reactivated", "skipped", "rejected"]
  );
  const after = Object.fromEntries(
    (await enrollments(courseId)).map((item) => [String(item.userId), item])
  );
  assert.equal(after[String(fresh)].status, "active");
  assert.equal(after[String(dropped)].status, "active");
  assert.ok(after[String(dropped)].enrolledAt > longAgo, "reactivated phải có enrolledAt mới");
  assert.deepEqual(after[String(active)].enrolledAt, longAgo, "skipped không được ghi lại");
  assert.equal(after[String(completed)].status, "completed");
  assert.deepEqual(after[String(completed)].completedAt, completedAt);

  const second = await harness.request("POST", importPath(tenantId, courseId), { rows }, owner);
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.summary, {
    total: 4,
    created: 0,
    reactivated: 0,
    skipped: 3,
    rejected: 1
  });
  assert.equal((await enrollments(courseId)).length, 4);

  // Chuỗi nhiều bước dùng API cũ: active --unenroll--> dropped --import--> active.
  const unenroll = await harness.request(
    "DELETE",
    "/admin/tenant/" + tenantId + "/courses/" + courseId + "/unenroll/" + fresh,
    undefined,
    owner
  );
  assert.equal(unenroll.status, 200, JSON.stringify(unenroll.body));
  const third = await harness.request(
    "POST",
    importPath(tenantId, courseId),
    { rows: rowsOf(fresh) },
    owner
  );
  assert.equal(third.body.results[0].outcome, "reactivated");
  assert.equal((await statusMap(courseId))[String(fresh)], "active");
});

test("IT-03 (AC4, negative) lecturer/student không được import và không có gì được ghi", async () => {
  const { tenantId, courseId, studentIds } = await setup(1);
  const lecturerId = await harness.createAccount("lecturer");
  const studentId = await harness.createAccount("student");
  await harness.addMembers(tenantId, [lecturerId], "lecturer");
  await harness.addMembers(tenantId, [studentId], "student");
  for (const actor of [lecturerId, studentId]) {
    const result = await harness.request(
      "POST",
      importPath(tenantId, courseId),
      { rows: rowsOf(studentIds[0], studentId) },
      await harness.login(actor)
    );
    assert.equal(result.status, 403, JSON.stringify(result.body));
    assert.equal(result.body.message, "Không đủ quyền!");
  }
  assert.equal((await enrollments(courseId)).length, 0);
});

test("IT-04 (AC4, negative + boundary) rows rỗng/không phải mảng/501 → 400; 500 → 200", async () => {
  const { tenantId, courseId, studentIds } = await setup(1);
  const path = importPath(tenantId, courseId);
  const tooMany = Array.from({ length: 501 }, () => ({ userId: String(studentIds[0]) }));
  for (const body of [{}, { rows: [] }, { rows: "abc" }, { rows: tooMany }, { rows: [], x: 1 }]) {
    const result = await harness.request("POST", path, body, owner);
    assert.equal(result.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal((await enrollments(courseId)).length, 0);
  const atLimit = await harness.request("POST", path, { rows: tooMany.slice(0, 500) }, owner);
  assert.equal(atLimit.status, 200, JSON.stringify(atLimit.body));
  assert.equal(atLimit.body.summary.created, 1);
  assert.equal(atLimit.body.summary.rejected, 499);
});

test("IT-05 (AC4, failure path) môn học đã xóa mềm → 404, không ghi enrollment", async () => {
  const { tenantId, courseId, studentIds } = await setup(2);
  await harness.tenantDb
    .collection("courses")
    .updateOne({ _id: courseId }, { $set: { deleted: true, deletedAt: new Date() } });
  const result = await harness.request(
    "POST",
    importPath(tenantId, courseId),
    { rows: rowsOf(...studentIds) },
    owner
  );
  assert.equal(result.status, 404, JSON.stringify(result.body));
  // 404 phải đến từ nghiệp vụ, không phải "route chưa tồn tại" (bản đầu của test pass sai lý do).
  assert.equal(result.body.message, "Không tìm thấy môn học!");
  assert.equal((await enrollments(courseId)).length, 0);
});

test("IT-06 (NFR2, failure path) lỗi DB giữa lô → rollback cả lô, dữ liệu cũ nguyên vẹn", async () => {
  const { tenantId, courseId, studentIds } = await setup(3);
  const [kept, ...newcomers] = studentIds;
  const longAgo = new Date("2026-01-01T00:00:00.000Z");
  await harness.tenantDb.collection("course_enrollments").insertOne({
    tenantId,
    courseId,
    userId: kept,
    status: "dropped",
    enrolledAt: longAgo,
    completedAt: null
  });
  const revisionBefore = (await harness.tenantDb.collection("tenants").findOne({ _id: tenantId }))!
    .revision;
  const admin = harness.tenantDb.db!.admin();
  await admin.command({
    configureFailPoint: "failCommand",
    mode: { times: 1 },
    data: { failCommands: ["update"], errorCode: 2 }
  });
  try {
    const failed = await harness.request(
      "POST",
      importPath(tenantId, courseId),
      { rows: rowsOf(kept, ...newcomers) },
      owner
    );
    assert.equal(failed.status, 500, JSON.stringify(failed.body));
    assert.equal(failed.body.code, "error");
  } finally {
    await admin.command({ configureFailPoint: "failCommand", mode: "off" });
  }
  assert.deepEqual(await statusMap(courseId), { [String(kept)]: "dropped" });
  assert.equal(
    (await harness.tenantDb.collection("tenants").findOne({ _id: tenantId }))!.revision,
    revisionBefore,
    "transaction phải rollback cả $inc revision"
  );
  const retry = await harness.request(
    "POST",
    importPath(tenantId, courseId),
    { rows: rowsOf(kept, ...newcomers) },
    owner
  );
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.summary, {
    total: 3,
    created: 2,
    reactivated: 1,
    skipped: 0,
    rejected: 0
  });
});

test("IT-07 (contract) member bị thu hồi không được import hồi sinh quyền hỏi trợ giảng", async () => {
  const { tenantId, courseId } = await setup(0);
  const studentId = await harness.createAccount("revoked-student");
  await harness.addMembers(tenantId, [studentId], "student", "revoked");
  await harness.tenantDb.collection("course_enrollments").insertOne({
    tenantId,
    courseId,
    userId: studentId,
    status: "dropped",
    enrolledAt: new Date(),
    completedAt: null
  });
  const result = await harness.request(
    "POST",
    importPath(tenantId, courseId),
    { rows: rowsOf(studentId) },
    owner
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.results[0].reason, "not_active_student");
  assert.deepEqual(await statusMap(courseId), { [String(studentId)]: "dropped" });
});

test("IT-08 (NFR2, concurrency) 5 lô chồng lấn chạy đồng thời không tạo enrollment trùng", async () => {
  const { tenantId, courseId, studentIds } = await setup(30);
  const indexes = await harness.tenantDb.collection("course_enrollments").indexes();
  assert.ok(
    indexes.some((index) => index.unique && index.key.courseId === 1 && index.key.userId === 1),
    "unique index (courseId, userId) phải tồn tại trước khi test đồng thời"
  );
  const batches = Array.from({ length: 5 }, (_value, index) =>
    rowsOf(...studentIds.slice(index * 5, index * 5 + 10))
  );
  const results = await Promise.all(
    batches.map((rows) => harness.request("POST", importPath(tenantId, courseId), { rows }, owner))
  );
  for (const result of results) assert.equal(result.status, 200, JSON.stringify(result.body));
  const created = results.reduce((sum, result) => sum + result.body.summary.created, 0);
  const all = await enrollments(courseId);
  const unique = new Set(all.map((item) => String(item.userId)));
  assert.equal(all.length, unique.size, "không có enrollment trùng");
  assert.equal(all.length, 30);
  assert.equal(created, 30, "mỗi sinh viên chỉ được báo created đúng một lần");
});

test("IT-R1 (AC5, regression/characterization) behavior ghi danh đơn lẻ và ACL không đổi", async () => {
  const { tenantId, courseIds } = await harness.seedTenant({ ownerId, courses: 2 });
  const [courseA, courseHidden] = courseIds;
  const studentId = await harness.createAccount("student");
  await harness.addMembers(tenantId, [studentId], "student");
  const student = await harness.login(studentId);
  const base = "/admin/tenant/" + tenantId + "/courses/";
  const enroll = () =>
    harness.request("POST", base + courseA + "/enroll", { userId: String(studentId) }, owner);
  assert.equal((await enroll()).status, 200);
  assert.equal((await enroll()).status, 409, "ghi danh đơn lẻ trùng vẫn phải 409");
  assert.equal(
    (await harness.request("DELETE", base + courseA + "/unenroll/" + studentId, undefined, owner))
      .status,
    200
  );
  assert.equal((await enroll()).status, 200, "ghi danh lại sau khi hủy vẫn 200");
  const list = await harness.request("GET", base + "list", undefined, student);
  assert.deepEqual(
    list.body.courses.map((item: any) => item._id),
    [String(courseA)]
  );
  assert.equal(
    (await harness.request("GET", base + "detail/" + courseHidden, undefined, student)).status,
    403
  );
  const oversized = JSON.stringify({ userId: String(studentId), pad: "x".repeat(33 * 1024) });
  assert.equal(
    (await harness.requestRaw("POST", base + courseA + "/enroll", oversized, owner)).status,
    413,
    "giới hạn JSON toàn cục 32 kB không đổi"
  );
});

test("IT-R2 (AC5, regression, thêm sau mutant M10) thêm lại member active → 409, import không đổi", async () => {
  const { tenantId, courseId } = await setup(0);
  const studentId = await harness.createAccount("student");
  const add = (role: string) =>
    harness.request(
      "POST",
      "/admin/tenant/" + tenantId + "/members/add",
      { userId: String(studentId), role },
      owner
    );
  assert.equal((await add("student")).status, 200);
  const again = await add("lecturer");
  assert.equal(again.status, 409, "member active không được 'add' lại để đổi vai trò ngầm");
  const members = await harness.tenantDb
    .collection("tenant_memberships")
    .find({ tenantId, userId: studentId })
    .toArray();
  assert.deepEqual(
    members.map((member) => member.role),
    ["student"]
  );
  const result = await harness.request(
    "POST",
    importPath(tenantId, courseId),
    { rows: rowsOf(studentId) },
    owner
  );
  assert.equal(result.body.results[0].outcome, "created");
});
