import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer, Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import adminRoutes from "../routes/admin/index.route";
import internalRoutes from "../routes/internal.route";
import { AuthClient } from "../helpers/auth.helper";
import { hashToken } from "../helpers/token.helper";
import Tenant from "../models/tenant.model";
import TenantMembership from "../models/tenant-membership.model";
import Course from "../models/course.model";
import CourseEnrollment from "../models/course-enrollment.model";
import LecturerAssignment from "../models/lecturer-assignment.model";
import { AccountIdentity } from "../interfaces/request.interface";
import { ServiceError } from "../helpers/error.helper";
import { DailyUsage, QuotaRequest } from "../models/quota-usage.model";
import { CourseService } from "../services/course.service";

const TEST = {
  origin: "http://localhost:3000",
  csrf: "p02-test-csrf",
  documentToken: "p02-document-service-token-for-tests-only",
  chatToken: "p02-chat-service-token-for-tests-only",
  mongoVersion: "7.0.24",
  active: "active",
  draft: "draft",
  archived: "archived",
  owner: "tenant_owner",
  admin: "tenant_admin",
  lecturer: "lecturer",
  student: "student"
} as const;

const IDs = {
  tenantA: new mongoose.Types.ObjectId(),
  tenantB: new mongoose.Types.ObjectId(),
  owner: new mongoose.Types.ObjectId(),
  admin: new mongoose.Types.ObjectId(),
  lecturer: new mongoose.Types.ObjectId(),
  student: new mongoose.Types.ObjectId(),
  outsider: new mongoose.Types.ObjectId(),
  activeCourse: new mongoose.Types.ObjectId(),
  alternateCourse: new mongoose.Types.ObjectId(),
  unassignedCourse: new mongoose.Types.ObjectId(),
  draftCourse: new mongoose.Types.ObjectId(),
  archivedCourse: new mongoose.Types.ObjectId(),
  otherCourse: new mongoose.Types.ObjectId()
} as const;

const originalIdentity = AuthClient.getIdentity;
const originalEnvironment = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  DOCUMENT_SERVICE_TOKEN: process.env.DOCUMENT_SERVICE_TOKEN,
  CHAT_SERVICE_TOKEN: process.env.CHAT_SERVICE_TOKEN
};
const databaseRoot = resolve(tmpdir(), "p02-tenant-tests");
let databasePath: string | undefined;
let mongo: MongoMemoryReplSet | undefined;
let server: Server | undefined;
let baseUrl: string;

const identities: Record<string, AccountIdentity> = Object.fromEntries(
  Object.entries({
    owner: IDs.owner,
    admin: IDs.admin,
    lecturer: IDs.lecturer,
    student: IDs.student,
    outsider: IDs.outsider
  }).map(([name, id]) => [
    name,
    {
      id: String(id),
      email: [name, "example.test"].join("@"),
      fullName: name,
      platformRole: "user" as const,
      tokenId: ["p02", name].join("-"),
      csrfHash: hashToken(TEST.csrf)
    }
  ])
);

const request = async (
  method: string,
  path: string,
  actor?: keyof typeof identities,
  body?: unknown,
  credential?: string,
  extraHeaders: Record<string, string> = {}
) => {
  const headers: Record<string, string> = { Origin: TEST.origin, ...extraHeaders };
  if (actor) {
    headers.Cookie = ["session=", actor].join("");
    headers["X-CSRF-Token"] = TEST.csrf;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (credential) headers.Authorization = ["Bearer ", credential].join("");
  const response = await fetch([baseUrl, path].join(""), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
};

const upload = (courseId: mongoose.Types.ObjectId, actor: keyof typeof identities) =>
  request(
    "POST",
    "/internal/authorization/course",
    actor,
    { courseId: String(courseId) },
    TEST.documentToken
  );

const consume = (
  courseId: mongoose.Types.ObjectId,
  actor: keyof typeof identities,
  requestId = randomUUID()
) =>
  request(
    "POST",
    "/internal/quota/chat/consume",
    actor,
    { tenantId: String(IDs.tenantA), courseId: String(courseId), requestId },
    TEST.chatToken
  );

before(async () => {
  process.env.ALLOWED_ORIGINS = TEST.origin;
  process.env.DOCUMENT_SERVICE_TOKEN = TEST.documentToken;
  process.env.CHAT_SERVICE_TOKEN = TEST.chatToken;
  AuthClient.getIdentity = async (cookie: string) => {
    const actor = cookie.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
    if (!actor || !identities[actor]) throw new ServiceError("Invalid test session", 401);
    return identities[actor];
  };

  await mkdir(databaseRoot, { recursive: true });
  databasePath = await mkdtemp(join(databaseRoot, "run-"));
  mongo = await MongoMemoryReplSet.create({
    instanceOpts: [{ dbPath: databasePath }],
    binary: { version: TEST.mongoVersion },
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  await mongoose.connect(mongo.getUri("p02_tenant_test"));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  await Tenant.create([
    { _id: IDs.tenantA, name: "Tenant A", code: "p02-a", status: TEST.active, quota: { maxDailyChats: 2 } },
    { _id: IDs.tenantB, name: "Tenant B", code: "p02-b", status: TEST.active }
  ]);
  await TenantMembership.create([
    { tenantId: IDs.tenantA, userId: IDs.owner, role: TEST.owner },
    { tenantId: IDs.tenantA, userId: IDs.admin, role: TEST.admin },
    { tenantId: IDs.tenantA, userId: IDs.lecturer, role: TEST.lecturer },
    { tenantId: IDs.tenantA, userId: IDs.student, role: TEST.student },
    { tenantId: IDs.tenantB, userId: IDs.outsider, role: TEST.owner }
  ]);
  await Course.create([
    { _id: IDs.activeCourse, tenantId: IDs.tenantA, code: "P02-A", name: "Active", status: TEST.active },
    { _id: IDs.alternateCourse, tenantId: IDs.tenantA, code: "P02-X", name: "Alternate", status: TEST.active },
    { _id: IDs.unassignedCourse, tenantId: IDs.tenantA, code: "P02-U", name: "Unassigned", status: TEST.active },
    { _id: IDs.draftCourse, tenantId: IDs.tenantA, code: "P02-D", name: "Draft", status: TEST.draft },
    { _id: IDs.archivedCourse, tenantId: IDs.tenantA, code: "P02-R", name: "Archived", status: TEST.archived },
    { _id: IDs.otherCourse, tenantId: IDs.tenantB, code: "P02-B", name: "Other", status: TEST.active }
  ]);
  await LecturerAssignment.create({ tenantId: IDs.tenantA, courseId: IDs.activeCourse, userId: IDs.lecturer });
  await CourseEnrollment.create({ tenantId: IDs.tenantA, courseId: IDs.activeCourse, userId: IDs.student });
  await CourseEnrollment.create({ tenantId: IDs.tenantA, courseId: IDs.alternateCourse, userId: IDs.student });

  const app = express();
  app.use(express.json());
  app.use("/internal", internalRoutes);
  app.use("/admin", adminRoutes);
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = ["http://127.0.0.1:", address.port].join("");
}, { timeout: 90000 });

beforeEach(async () => {
  await DailyUsage.deleteMany({ tenantId: IDs.tenantA });
  await QuotaRequest.deleteMany({ tenantId: IDs.tenantA });
});

after(async () => {
  AuthClient.getIdentity = originalIdentity;
  Object.entries(originalEnvironment).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  if (server?.listening) await new Promise<void>((done) => server!.close(() => done()));
  await mongoose.disconnect();
  await mongo?.stop();
  if (databasePath) {
    const resolved = resolve(databasePath);
    assert.ok(resolved.startsWith([databaseRoot, sep].join("")), "Unsafe test cleanup path");
    await rm(resolved, { recursive: true, force: true });
  }
});

test("owner and admin cannot upload or consume Chat quota on draft or archived courses", async () => {
  assert.equal((await upload(IDs.activeCourse, "owner")).status, 200);
  assert.equal((await upload(IDs.activeCourse, "lecturer")).status, 200);
  assert.equal((await consume(IDs.activeCourse, "admin")).status, 200);
  assert.equal((await upload(IDs.draftCourse, "owner")).status, 403);
  assert.equal((await upload(IDs.archivedCourse, "admin")).status, 403);
  assert.equal((await consume(IDs.draftCourse, "owner")).status, 403);
  assert.equal((await consume(IDs.archivedCourse, "admin")).status, 403);
  assert.equal(await QuotaRequest.countDocuments({ tenantId: IDs.tenantA }), 1);
  assert.equal((await DailyUsage.findOne({ tenantId: IDs.tenantA }))?.chatCount, 1);
});

test("manager reads and maintains draft or archived courses without widening student list", async () => {
  const draftDetail = await request(
    "GET",
    ["/admin/tenant/", IDs.tenantA, "/courses/detail/", IDs.draftCourse].join(""),
    "owner"
  );
  assert.equal(draftDetail.status, 200);
  assert.equal(draftDetail.body.course.status, TEST.draft);
  const archivedDetail = await request(
    "GET",
    ["/admin/tenant/", IDs.tenantA, "/courses/detail/", IDs.archivedCourse].join(""),
    "admin"
  );
  assert.equal(archivedDetail.status, 200);
  assert.equal(await CourseService.canAccessCourse(String(IDs.tenantA), String(IDs.draftCourse), String(IDs.owner), "document:read"), true);
  assert.equal(await CourseService.canAccessCourse(String(IDs.tenantA), String(IDs.archivedCourse), String(IDs.admin), "document:delete"), true);
  assert.equal(await CourseService.canAccessCourse(String(IDs.tenantA), String(IDs.archivedCourse), String(IDs.owner), "feedback:write"), true);
  const draftStudentsPath = ["/admin/tenant/", IDs.tenantA, "/courses/", IDs.draftCourse, "/students"].join("");
  const archivedStudentsPath = ["/admin/tenant/", IDs.tenantA, "/courses/", IDs.archivedCourse, "/students"].join("");
  const draftStudents = await request("GET", draftStudentsPath, "owner");
  assert.equal(draftStudents.status, 200);
  assert.ok(Array.isArray(draftStudents.body.students));
  assert.equal((await request("GET", archivedStudentsPath, "admin")).status, 200);
  assert.equal((await request("GET", draftStudentsPath, "student")).status, 403);
  const activeStudentsPath = ["/admin/tenant/", IDs.tenantA, "/courses/", IDs.activeCourse, "/students"].join("");
  assert.equal((await request("GET", activeStudentsPath, "lecturer")).status, 200);
  assert.equal((await request("GET", activeStudentsPath, "student")).status, 403);
  const edit = await request(
    "PATCH",
    ["/admin/tenant/", IDs.tenantA, "/courses/edit/", IDs.draftCourse].join(""),
    "admin",
    { name: "Draft managed" }
  );
  assert.equal(edit.status, 200);
  assert.equal(edit.body.course.name, "Draft managed");
  const assignment = await request(
    "POST",
    ["/admin/tenant/", IDs.tenantA, "/courses/", IDs.draftCourse, "/assign-lecturer"].join(""),
    "owner",
    { userId: String(IDs.lecturer) }
  );
  assert.equal(assignment.status, 200);
  assert.equal((await request("GET", draftStudentsPath, "lecturer")).status, 403);
  const enrollment = await request(
    "POST",
    ["/admin/tenant/", IDs.tenantA, "/courses/", IDs.archivedCourse, "/enroll"].join(""),
    "admin",
    { userId: String(IDs.student) }
  );
  assert.equal(enrollment.status, 200);
  const archivedStudents = await request("GET", archivedStudentsPath, "owner");
  assert.equal(archivedStudents.status, 200);
  assert.equal(archivedStudents.body.students.length, 1);
  assert.equal((await request("GET", archivedStudentsPath, "student")).status, 403);
});

test("tenant boundary, assignments, enrollment and inactive tenant deny access without mutation", async () => {
  const crossDetail = await request(
    "GET",
    ["/admin/tenant/", IDs.tenantB, "/courses/detail/", IDs.otherCourse].join(""),
    "owner"
  );
  assert.equal(crossDetail.status, 403);
  const crossEdit = await request(
    "PATCH",
    ["/admin/tenant/", IDs.tenantA, "/courses/edit/", IDs.otherCourse].join(""),
    "owner",
    { name: "Forbidden change" }
  );
  assert.equal(crossEdit.status, 404);
  assert.equal((await Course.findById(IDs.otherCourse))?.name, "Other");
  const crossStudents = await request(
    "GET",
    ["/admin/tenant/", IDs.tenantA, "/courses/", IDs.otherCourse, "/students"].join(""),
    "owner"
  );
  assert.equal(crossStudents.status, 403);
  assert.equal((await upload(IDs.alternateCourse, "lecturer")).status, 403);
  assert.equal((await upload(IDs.unassignedCourse, "lecturer")).status, 403);
  assert.equal((await consume(IDs.unassignedCourse, "student")).status, 403);
  assert.equal((await consume(IDs.draftCourse, "student")).status, 403);
  assert.equal((await consume(IDs.activeCourse, "outsider")).status, 403);
  assert.equal((await request(
    "GET",
    ["/admin/tenant/", IDs.tenantA, "/courses/detail/", IDs.activeCourse].join(""),
    "outsider"
  )).status, 403);
  await Tenant.updateOne({ _id: IDs.tenantA }, { status: "suspended" });
  try {
    assert.equal((await upload(IDs.activeCourse, "owner")).status, 403);
    assert.equal((await consume(IDs.activeCourse, "student")).status, 404);
  } finally {
    await Tenant.updateOne({ _id: IDs.tenantA }, { status: TEST.active });
  }
  assert.equal(await QuotaRequest.countDocuments({ tenantId: IDs.tenantA }), 0);
});

test("internal credential and verified session boundaries reject forged actors", async () => {
  const quotaPath = "/internal/quota/chat/consume";
  const quotaBody = {
    tenantId: String(IDs.tenantA),
    courseId: String(IDs.activeCourse),
    requestId: randomUUID()
  };
  assert.equal((await request("POST", quotaPath, "student", quotaBody, TEST.documentToken)).status, 401);
  assert.equal((await request("POST", quotaPath, undefined, quotaBody, TEST.chatToken)).status, 401);
  assert.equal((await request("POST", quotaPath, "outsider", quotaBody, TEST.chatToken, {
    "X-User-Id": String(IDs.student)
  })).status, 403);
  assert.equal((await request(
    "POST",
    "/internal/authorization/course",
    "lecturer",
    { courseId: String(IDs.activeCourse) },
    TEST.chatToken
  )).status, 401);
  assert.equal((await request(
    "POST",
    "/internal/authorization/check",
    "student",
    { tenantId: String(IDs.tenantA), courseId: String(IDs.activeCourse), action: "chat:ask" },
    TEST.chatToken
  )).status, 200);
  assert.equal((await request(
    "POST",
    "/internal/authorization/check",
    "outsider",
    { tenantId: String(IDs.tenantA), courseId: String(IDs.activeCourse), action: "chat:ask" },
    TEST.chatToken,
    { "X-User-Id": String(IDs.student) }
  )).status, 403);
  assert.equal(await QuotaRequest.countDocuments({ tenantId: IDs.tenantA }), 0);
});

test("quota retry is idempotent and conflicts or limits do not increment usage", async () => {
  const requestId = randomUUID();
  const first = await consume(IDs.activeCourse, "student", requestId);
  assert.equal(first.status, 200);
  assert.equal(first.body.consumed, true);
  const replay = await consume(IDs.activeCourse, "student", requestId);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.consumed, false);
  assert.equal((await consume(IDs.activeCourse, "owner", requestId)).status, 409);
  assert.equal((await consume(IDs.alternateCourse, "student", requestId)).status, 409);
  assert.equal((await DailyUsage.findOne({ tenantId: IDs.tenantA }))?.chatCount, 1);
  assert.equal((await consume(IDs.alternateCourse, "student")).status, 200);
  assert.equal((await consume(IDs.activeCourse, "student")).status, 409);
  assert.equal((await DailyUsage.findOne({ tenantId: IDs.tenantA }))?.chatCount, 2);
  assert.equal(await QuotaRequest.countDocuments({ tenantId: IDs.tenantA }), 2);
});
