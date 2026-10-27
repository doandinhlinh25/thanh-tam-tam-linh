import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { compose } from "./sandbox.mjs";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();
function s3Authorization(env, url, method) {
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = stamp.slice(0, 8),
    payload = sha256("");
  const scope = date + "/us-east-1/s3/aws4_request";
  const headers =
    "host:" + url.host + "\nx-amz-content-sha256:" + payload + "\nx-amz-date:" + stamp + "\n";
  const signed = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, url.pathname, "", headers, signed, payload].join("\n");
  const key = hmac(
    hmac(hmac(hmac("AWS4" + env.S3_SECRET_KEY, date), "us-east-1"), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", key)
    .update(["AWS4-HMAC-SHA256", stamp, scope, sha256(canonical)].join("\n"))
    .digest("hex");
  return {
    "x-amz-date": stamp,
    "x-amz-content-sha256": payload,
    Authorization:
      "AWS4-HMAC-SHA256 Credential=" +
      env.S3_ACCESS_KEY +
      "/" +
      scope +
      ", SignedHeaders=" +
      signed +
      ", Signature=" +
      signature
  };
}
export async function smoke(env) {
  const auth = "http://127.0.0.1:" + env.AUTH_PORT,
    tenant = "http://127.0.0.1:" + env.TENANT_PORT;
  const document = "http://127.0.0.1:" + env.DOCUMENT_PORT,
    origin = "http://localhost:3000";
  const run = randomUUID().slice(0, 8),
    password = "Sandbox-" + randomUUID();
  const pdf = Buffer.from(
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
  );
  async function api(base, route, method = "GET", body, user, extra = {}) {
    const headers = { Origin: origin, ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (user?.cookie) headers.Cookie = user.cookie;
    if (user?.csrf) headers["X-CSRF-Token"] = user.csrf;
    const response = await fetch(base + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0]
    };
  }
  function ok(result, status = 200) {
    assert.equal(
      result.status,
      status,
      "Unexpected HTTP status; response fields intentionally omitted to avoid exposing credentials"
    );
    return result.data;
  }
  async function login(email, pass) {
    const response = await api(auth, "/admin/account/login", "POST", { email, password: pass });
    ok(response);
    return { cookie: response.cookie, csrf: response.data.csrfToken };
  }
  for (const base of [auth, tenant, document]) {
    assert.equal(
      (await fetch(base + "/health/ready", { signal: AbortSignal.timeout(15000) })).status,
      200
    );
  }
  const admin = await login(env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_PASSWORD);
  async function account(suffix) {
    const email = "sandbox-" + run + "-" + suffix + "@example.com";
    const data = ok(
      await api(
        auth,
        "/admin/account-admin/create",
        "POST",
        {
          email,
          fullName: "Sandbox " + suffix,
          password,
          confirmPassword: password,
          status: "active"
        },
        admin
      )
    );
    return { id: data.account._id, user: await login(email, password) };
  }
  const owner = await account("owner"),
    outsider = await account("outsider");
  const tenantData = ok(
    await api(
      tenant,
      "/admin/tenant/create",
      "POST",
      {
        name: "Sandbox " + run,
        code: "sandbox-" + run,
        ownerId: owner.id
      },
      admin
    )
  );
  const tenantId = tenantData.tenant._id;
  const courseData = ok(
    await api(
      tenant,
      "/admin/tenant/" + tenantId + "/courses/create",
      "POST",
      {
        code: "SANDBOX-" + run.toUpperCase(),
        name: "Sandbox upload"
      },
      owner.user
    )
  );
  const courseId = courseData.course._id;
  ok(
    await api(tenant, "/internal/authorization/course", "POST", { courseId }, owner.user, {
      Authorization: "Bearer " + env.DOCUMENT_SERVICE_TOKEN
    })
  );
  assert.equal(
    (
      await api(tenant, "/internal/authorization/course", "POST", { courseId }, owner.user, {
        Authorization: "Bearer deliberately-invalid-service-token"
      })
    ).status,
    401
  );
  async function upload(user, key) {
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "sandbox.pdf");
    return fetch(document + "/api/v1/courses/" + courseId + "/documents", {
      method: "POST",
      headers: { ...(user ? { Cookie: user.cookie } : {}), "Idempotency-Key": key },
      body: form,
      signal: AbortSignal.timeout(20000)
    });
  }
  assert.equal((await upload(undefined, "anon-" + run)).status, 401);
  assert.equal((await upload(outsider.user, "outsider-" + run)).status, 403);
  const uploaded = await upload(owner.user, "upload-" + run);
  assert.equal(uploaded.status, 202);
  const body = await uploaded.json();
  assert.equal(body.successful, true);
  assert.equal(body.data.tenantId, tenantId);
  const documentId = body.data.documentId;
  assert.match(documentId, /^[a-f0-9-]{36}$/);
  const replay = await upload(owner.user, "upload-" + run);
  assert.equal(replay.status, 202);
  assert.equal((await replay.json()).data.documentId, documentId);
  const row = JSON.parse(
    compose(
      [
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "document",
        "-d",
        "document_sandbox",
        "-Atc",
        "SELECT row_to_json(d) FROM documents d WHERE document_id = '" + documentId + "'"
      ],
      env,
      true
    )
  );
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.uploader_user_id, owner.id);
  assert.equal(row.checksum_sha256, sha256(pdf));
  assert.equal(row.status, "QUEUED");
  const stream = JSON.parse(
    compose(
      [
        "exec",
        "-T",
        "redis",
        "redis-cli",
        "--json",
        "XREVRANGE",
        "document-ingestion",
        "+",
        "-",
        "COUNT",
        "100"
      ],
      env,
      true
    )
  );
  const events = stream.map(([, fields]) => JSON.parse(fields[fields.indexOf("payload") + 1]));
  assert.equal(
    events.filter((event) => event.documentId === documentId).length,
    1,
    "Expected one ingestion event after an idempotent retry"
  );
  const url = new URL(
    "http://127.0.0.1:" +
      env.S3_PORT +
      "/document-sandbox-private/" +
      row.storage_key.split("/").map(encodeURIComponent).join("/")
  );
  assert.equal(
    (await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) })).status,
    403
  );
  const stored = await fetch(url, {
    headers: s3Authorization(env, url, "GET"),
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(stored.status, 200);
  assert.equal(sha256(Buffer.from(await stored.arrayBuffer())), sha256(pdf));
  console.log(
    "PASS: readiness; JWT login; service tokens; tenant/course ACL; anonymous/outsider rejection; PDF upload and retry; PostgreSQL metadata; Redis event; private S3 bytes."
  );
  console.log(
    "Sandbox fixture IDs: tenant=" + tenantId + ", course=" + courseId + ", document=" + documentId
  );
}
