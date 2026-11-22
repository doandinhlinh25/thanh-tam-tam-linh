import { uploadPdf } from "../infrastructure/sandbox/pdf-fixture.mjs";
import { documentRows } from "../infrastructure/sandbox/document-mongo.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readEnv, validateEnv } from "./sandbox-env.mjs";
import { compose } from "./sandbox.mjs";
import { s3Authorization } from "./sandbox-smoke.mjs";

const HTTP_STATUS = Object.freeze({
  OK: 200,
  ACCEPTED: 202,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UNAVAILABLE: 503
});
const ERROR_CODE = Object.freeze({
  CONFLICT: "DOCUMENT_IDEMPOTENCY_CONFLICT",
  UNAVAILABLE: "DOCUMENT_DEPENDENCY_UNAVAILABLE"
});
const ROLE = Object.freeze({ LECTURER: "lecturer", STUDENT: "student" });
const PDF_MIME = "application/pdf";
const BUCKET_NAME = "document-sandbox-private";
const REDIS_STREAM = "document-ingestion";
const HOST = "127.0.0.1";
const HEALTH_PATH = "/health/ready";
const UPLOAD_PATH_PREFIX = "/api/v1/courses/";
const UPLOAD_PATH_SUFFIX = "/documents";
const REQUEST_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 20000;
const TENANT_RESTART_TIMEOUT_MS = 60000;
const RESTART_POLL_MS = 1000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = validateEnv(readEnv(path.join(root, "infrastructure/sandbox/.env")));
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, ".test-data/document-upload-fixture.json"), "utf8")
);
const runId = randomUUID().slice(0, 8);
const uploadUrl = new URL(
  UPLOAD_PATH_PREFIX + fixture.courseId + UPLOAD_PATH_SUFFIX,
  fixture.documentBaseUrl
);
const bucketUrl = new URL("/" + BUCKET_NAME, "http://" + HOST + ":" + env.S3_PORT);
const pdf = uploadPdf();
const changedPdf = Buffer.concat([pdf, Buffer.from("% changed content\n")]);
const digest = (value) => createHash("sha256").update(value).digest("hex");

assert.match(fixture.tenantId, /^[a-f0-9]{24}$/);
assert.match(fixture.courseId, /^[a-f0-9]{24}$/);
assert.match(fixture.allowed.id, /^[a-f0-9]{24}$/);
assert.match(fixture.denied.id, /^[a-f0-9]{24}$/);
assert.match(
  fixture.otherTenant?.tenantId || "",
  /^[a-f0-9]{24}$/,
  "Regenerate fixtures for two real tenants"
);
assert.match(fixture.otherTenant?.courseId || "", /^[a-f0-9]{24}$/);
assert.notEqual(fixture.otherTenant.courseId, fixture.courseId);
assert.notEqual(fixture.otherTenant.tenantId, fixture.tenantId);
assert.equal(fixture.allowed.role, ROLE.LECTURER);
assert.equal(fixture.denied.role, ROLE.STUDENT);
assert.ok(new Date(fixture.allowed.expiresAt).getTime() > Date.now());
assert.ok(new Date(fixture.denied.expiresAt).getTime() > Date.now());
assert.equal(fixture.documentBaseUrl, "http://" + HOST + ":" + env.DOCUMENT_PORT);

async function storedObjects(scope = fixture) {
  const url = new URL(bucketUrl);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", scope.tenantId + "/" + scope.courseId + "/");
  url.searchParams.sort();
  const response = await fetch(url, {
    headers: s3Authorization(env, url, "GET"),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert.equal(response.status, HTTP_STATUS.OK, "Cannot list sandbox objects");
  const xml = await response.text();
  assert.match(xml, /<ListBucketResult/);
  return [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => match[1]).sort();
}

function ingestionEvents(scope = fixture) {
  const entries = JSON.parse(
    compose(
      ["exec", "-T", "redis", "redis-cli", "--json", "XRANGE", REDIS_STREAM, "-", "+"],
      env,
      true
    )
  );
  return entries
    .map(([, fields]) => JSON.parse(fields[fields.indexOf("payload") + 1]))
    .filter((event) => event.tenantId === scope.tenantId)
    .map((event) => event.documentId)
    .sort();
}

async function snapshot(scope = fixture) {
  const { documents, jobs } = documentRows(env, scope.tenantId, scope.courseId);
  documents.sort((a, b) => a.document_id.localeCompare(b.document_id));
  return { documents, jobs, objects: await storedObjects(scope), events: ingestionEvents(scope) };
}

async function upload(session, key, bytes = pdf, extraHeaders = {}, targetUrl = uploadUrl) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: PDF_MIME }), "lesson.pdf");
  return fetch(targetUrl, {
    method: "POST",
    headers: {
      ...(session?.cookie ? { Cookie: session.cookie } : {}),
      "Idempotency-Key": key,
      ...extraHeaders
    },
    body: form,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
  });
}

function unchanged(before, after) {
  assert.deepEqual(after, before, "A denied or repeated request changed sandbox data");
}

async function verifyStoredPdf(row, bytes) {
  const url = new URL(
    "/" + BUCKET_NAME + "/" + row.storage_key.split("/").map(encodeURIComponent).join("/"),
    bucketUrl
  );
  assert.equal(
    (await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })).status,
    HTTP_STATUS.FORBIDDEN,
    "S3 object must not allow anonymous reads"
  );
  const response = await fetch(url, {
    headers: s3Authorization(env, url, "GET"),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  assert.equal(response.status, HTTP_STATUS.OK);
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(bytes));
}

async function waitForTenant() {
  const deadline = Date.now() + TENANT_RESTART_TIMEOUT_MS;
  const healthUrl = fixture.tenantBaseUrl + HEALTH_PATH;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(healthUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })).ok) return;
    } catch {
      // The sandbox may still be restarting.
    }
    await new Promise((resolve) => setTimeout(resolve, RESTART_POLL_MS));
  }
  throw new Error("Tenant did not become ready after the outage test");
}

async function main() {
  assert.equal(
    (
      await fetch(fixture.documentBaseUrl + HEALTH_PATH, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
    ).status,
    HTTP_STATUS.OK
  );
  const otherCourseResponse = await fetch(
    fixture.tenantBaseUrl +
      "/admin/tenant/" +
      fixture.otherTenant.tenantId +
      "/courses/detail/" +
      fixture.otherTenant.courseId,
    { headers: { Cookie: fixture.denied.cookie }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  );
  assert.equal(
    otherCourseResponse.status,
    HTTP_STATUS.OK,
    "U6 requires an existing second tenant/course"
  );
  const otherCourseBody = await otherCourseResponse.json();
  assert.equal(otherCourseBody.course.tenantId, fixture.otherTenant.tenantId);
  const initial = await snapshot();
  const key = "upload-e2e-" + runId;

  const accepted = await upload(fixture.allowed, key);
  assert.equal(accepted.status, HTTP_STATUS.ACCEPTED, "U1: authorized upload must be accepted");
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.successful, true);
  assert.equal(acceptedBody.data.tenantId, fixture.tenantId);
  assert.equal(acceptedBody.data.courseId, fixture.courseId);
  const documentId = acceptedBody.data.documentId;
  const afterU1 = await snapshot();
  const acceptedRow = afterU1.documents.find((row) => row.document_id === documentId);
  assert.ok(acceptedRow);
  assert.equal(afterU1.documents.length, initial.documents.length + 1);
  assert.equal(afterU1.jobs, initial.jobs + 1);
  assert.equal(afterU1.objects.length, initial.objects.length + 1);
  assert.deepEqual(afterU1.events, [...initial.events, documentId].sort());
  assert.equal(acceptedRow.uploader_user_id, fixture.allowed.id);
  assert.equal(acceptedRow.checksum_sha256, digest(pdf));
  assert.equal(acceptedRow.status, "QUEUED");
  assert.ok(afterU1.objects.includes(acceptedRow.storage_key));
  await verifyStoredPdf(acceptedRow, pdf);
  console.log("PASS U1: HTTP 202, one metadata row, private PDF, ingestion job and event");

  assert.equal((await upload(undefined, "u2-" + runId)).status, HTTP_STATUS.UNAUTHORIZED);
  unchanged(afterU1, await snapshot());
  console.log("PASS U2: anonymous HTTP 401 without side effects");

  assert.equal((await upload(fixture.denied, "u3-" + runId)).status, HTTP_STATUS.FORBIDDEN);
  unchanged(afterU1, await snapshot());
  console.log("PASS U3: student HTTP 403 without side effects");

  const repeated = await upload(fixture.allowed, key);
  assert.equal(repeated.status, HTTP_STATUS.ACCEPTED);
  assert.equal((await repeated.json()).data.documentId, documentId);
  unchanged(afterU1, await snapshot());
  console.log("PASS U4: identical retry returns the same document without new writes");

  const conflict = await upload(fixture.allowed, key, changedPdf);
  assert.equal(conflict.status, HTTP_STATUS.CONFLICT);
  assert.equal((await conflict.json()).error.errorCode, ERROR_CODE.CONFLICT);
  unchanged(afterU1, await snapshot());
  console.log("PASS U5: changed bytes with the same key return 409 without side effects");

  assert.notEqual(fixture.otherTenant.tenantId, fixture.tenantId);
  const otherBefore = await snapshot(fixture.otherTenant);
  const crossTenant = await upload(
    fixture.allowed,
    "u6-cross-" + runId,
    pdf,
    { "X-Tenant-Id": fixture.tenantId },
    new URL(
      UPLOAD_PATH_PREFIX + fixture.otherTenant.courseId + UPLOAD_PATH_SUFFIX,
      fixture.documentBaseUrl
    )
  );
  assert.equal(crossTenant.status, HTTP_STATUS.FORBIDDEN);
  unchanged(otherBefore, await snapshot(fixture.otherTenant));
  const forged = { "X-Tenant-Id": fixture.otherTenant.tenantId, "X-User-Id": fixture.allowed.id };
  assert.equal(
    (await upload(fixture.denied, "u6-denied-" + runId, pdf, forged)).status,
    HTTP_STATUS.FORBIDDEN
  );
  unchanged(afterU1, await snapshot());
  const forgedAllowed = await upload(fixture.allowed, "u6-allowed-" + runId, pdf, {
    ...forged,
    "X-User-Id": fixture.denied.id
  });
  assert.equal(forgedAllowed.status, HTTP_STATUS.ACCEPTED);
  const forgedBody = await forgedAllowed.json();
  assert.equal(forgedBody.data.tenantId, fixture.tenantId);
  const afterU6 = await snapshot();
  assert.equal(afterU6.documents.length, afterU1.documents.length + 1);
  assert.equal(afterU6.jobs, afterU1.jobs + 1);
  assert.equal(afterU6.objects.length, afterU1.objects.length + 1);
  assert.deepEqual(afterU6.events, [...afterU1.events, forgedBody.data.documentId].sort());
  assert.equal(
    afterU6.documents.find((row) => row.document_id === forgedBody.data.documentId)
      .uploader_user_id,
    fixture.allowed.id
  );
  unchanged(otherBefore, await snapshot(fixture.otherTenant));
  console.log(
    "PASS U6: two real tenants; forged identity headers neither elevate nor replace the verified user"
  );

  compose(["stop", "tenant"], env, true);
  try {
    const unavailable = await upload(fixture.allowed, "u7-" + runId);
    assert.equal(unavailable.status, HTTP_STATUS.UNAVAILABLE);
    assert.equal((await unavailable.json()).error.errorCode, ERROR_CODE.UNAVAILABLE);
    unchanged(afterU6, await snapshot());
  } finally {
    compose(["start", "tenant"], env, true);
    await waitForTenant();
  }
  console.log("PASS U7: Tenant outage returns 503 without side effects; Tenant restarted");
  console.log(
    "PASS U1-U7: run=" + runId + ", tenant=" + fixture.tenantId + ", course=" + fixture.courseId
  );
}

main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError ? error.message : "Upload E2E failed: " + error.message
  );
  process.exitCode = 1;
});
