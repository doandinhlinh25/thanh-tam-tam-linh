import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readEnv, validateEnv } from "./sandbox-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = validateEnv(readEnv(path.join(root, "infrastructure/sandbox/.env")));
const auth = "http://127.0.0.1:" + env.AUTH_PORT;
const tenant = "http://127.0.0.1:" + env.TENANT_PORT;
const directory = path.join(root, ".test-data");

async function main() {
  for (const base of [auth, tenant]) {
    const response = await fetch(base + "/health/ready", { signal: AbortSignal.timeout(5000) });
    if (!response.ok)
      throw new Error("Auth/Tenant are not ready; start the sandbox before creating fixtures.");
  }
  const run = randomUUID().slice(0, 8);
  const password = randomBytes(24).toString("base64url");
  async function api(base, route, method, body, session, extra = {}) {
    const headers = { Origin: "http://localhost:3000", ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (session?.cookie) headers.Cookie = session.cookie;
    if (session?.csrfToken) headers["X-CSRF-Token"] = session.csrfToken;
    const response = await fetch(base + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    return {
      status: response.status,
      data,
      cookie: response.headers.get("set-cookie")?.split(";")[0]
    };
  }
  const success = (result) => {
    assert.equal(
      result.status,
      200,
      "Fixture API request failed; credentials and response body omitted"
    );
    return result.data;
  };
  async function login(email, pass) {
    const response = await api(auth, "/admin/account/login", "POST", {
      email,
      password: pass,
      rememberPassword: true
    });
    success(response);
    assert.match(response.cookie || "", /^tokenAdmin=.+/);
    return { cookie: response.cookie, csrfToken: response.data.csrfToken };
  }
  const admin = await login(env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_PASSWORD);
  async function createAccount(role) {
    const email = "upload-" + role + "-" + run + "@sandbox.example.com";
    const data = success(
      await api(
        auth,
        "/admin/account-admin/create",
        "POST",
        {
          email,
          fullName: "Document upload " + role,
          password,
          confirmPassword: password,
          status: "active"
        },
        admin
      )
    );
    return { id: data.account._id, email, password };
  }
  const lecturer = await createAccount("lecturer");
  const student = await createAccount("student");
  const tenantData = success(
    await api(
      tenant,
      "/admin/tenant/create",
      "POST",
      {
        name: "Document upload " + run,
        code: "document-upload-" + run,
        ownerId: env.SUPER_ADMIN_ID
      },
      admin
    )
  );
  const tenantId = tenantData.tenant._id;
  for (const [account, role] of [
    [lecturer, "lecturer"],
    [student, "student"]
  ]) {
    success(
      await api(
        tenant,
        "/admin/tenant/" + tenantId + "/members/add",
        "POST",
        {
          userId: account.id,
          role
        },
        admin
      )
    );
  }
  const courseData = success(
    await api(
      tenant,
      "/admin/tenant/" + tenantId + "/courses/create",
      "POST",
      {
        name: "Document upload permission test",
        code: "UPLOAD-" + run.toUpperCase(),
        status: "active"
      },
      admin
    )
  );
  const courseId = courseData.course._id;
  for (const [account, route] of [
    [lecturer, "assign-lecturer"],
    [student, "enroll"]
  ]) {
    success(
      await api(
        tenant,
        "/admin/tenant/" + tenantId + "/courses/" + courseId + "/" + route,
        "POST",
        {
          userId: account.id
        },
        admin
      )
    );
  }
  const allowed = await login(lecturer.email, password);
  const denied = await login(student.email, password);
  for (const [account, session] of [
    [lecturer, allowed],
    [student, denied]
  ]) {
    const me = success(await api(auth, "/admin/account/me", "GET", undefined, session));
    assert.equal(me.account.id, account.id);
    success(
      await api(
        tenant,
        "/admin/tenant/" + tenantId + "/courses/detail/" + courseId,
        "GET",
        undefined,
        session
      )
    );
  }
  const authorized = await api(
    tenant,
    "/internal/authorization/course",
    "POST",
    { courseId },
    allowed,
    {
      Authorization: "Bearer " + env.DOCUMENT_SERVICE_TOKEN
    }
  );
  assert.equal(authorized.status, 200);
  assert.equal(authorized.data.data.allowed, true);
  assert.equal(authorized.data.data.tenantId, tenantId);
  assert.equal(authorized.data.data.userId, lecturer.id);
  const forbidden = await api(
    tenant,
    "/internal/authorization/course",
    "POST",
    { courseId },
    denied,
    {
      Authorization: "Bearer " + env.DOCUMENT_SERVICE_TOKEN
    }
  );
  assert.equal(forbidden.status, 403);
  const expiry = (session) =>
    new Date(
      JSON.parse(
        Buffer.from(
          session.cookie.slice("tokenAdmin=".length).split(".")[1],
          "base64url"
        ).toString()
      ).exp * 1000
    ).toISOString();
  const fixture = {
    createdAt: new Date().toISOString(),
    authBaseUrl: auth,
    tenantBaseUrl: tenant,
    documentBaseUrl: "http://127.0.0.1:" + env.DOCUMENT_PORT,
    tenantId,
    courseId,
    allowed: {
      ...lecturer,
      ...allowed,
      expiresAt: expiry(allowed),
      role: "lecturer",
      profileStatus: 200,
      courseReadStatus: 200,
      uploadAuthorizationStatus: 200
    },
    denied: {
      ...student,
      ...denied,
      expiresAt: expiry(denied),
      role: "student",
      profileStatus: 200,
      courseReadStatus: 200,
      uploadAuthorizationStatus: 403
    }
  };
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, "document-upload-fixture.json");
  fs.writeFileSync(output, JSON.stringify(fixture, null, 2) + "\n", { mode: 0o600 });
  const values = [
    ["authBaseUrl", auth],
    ["tenantBaseUrl", tenant],
    ["documentBaseUrl", fixture.documentBaseUrl],
    ["tenantId", tenantId],
    ["courseId", courseId],
    ["uploadAllowedCookie", allowed.cookie],
    ["uploadDeniedCookie", denied.cookie],
    ["uploadAllowedToken", allowed.cookie.slice("tokenAdmin=".length)],
    ["uploadDeniedToken", denied.cookie.slice("tokenAdmin=".length)],
    ["uploadAllowedCsrf", allowed.csrfToken],
    ["uploadDeniedCsrf", denied.csrfToken]
  ].map(([key, value]) => ({
    key,
    value,
    enabled: true,
    type: /Cookie|Token|Csrf/.test(key) ? "secret" : "default"
  }));
  fs.writeFileSync(
    path.join(directory, "document-upload.postman_environment.json"),
    JSON.stringify(
      {
        id: randomUUID(),
        name: "Document upload permissions (private)",
        values,
        _postman_variable_scope: "environment"
      },
      null,
      2
    ) + "\n",
    { mode: 0o600 }
  );
  console.log(
    JSON.stringify({
      tenantId,
      courseId,
      allowed: {
        email: lecturer.email,
        role: "lecturer",
        profile: 200,
        courseRead: 200,
        upload: 200
      },
      denied: { email: student.email, role: "student", profile: 200, courseRead: 200, upload: 403 },
      privateFixture: output
    })
  );
}
main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Cannot create fixtures: " + error.message
  );
  process.exitCode = 1;
});
