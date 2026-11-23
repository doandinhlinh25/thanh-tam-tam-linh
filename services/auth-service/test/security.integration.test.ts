import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const ORIGIN = "http://localhost:3000";
const OTHER_ORIGIN = "https://other.example.test";
const JWT_SECRET = "local-auth-test-jwt-secret-with-32-characters";
const SERVICE_TOKEN = "local-auth-test-service-token-32-characters";
const ACCOUNT_EMAIL = "auth-regression@example.com";
const ACCOUNT_PASSWORD = "Local-auth-test-password-2026!";
const LOGIN_PATH = "/admin/account/login";
const ME_PATH = "/admin/account/me";
const CHANGE_PASSWORD_PATH = "/admin/account/change-password";
const INTROSPECT_PATH = "/internal/auth/introspect";
const RATE_CASES = [
  { path: LOGIN_PATH, limit: 15 },
  { path: "/admin/account/password/forgot", limit: 10 },
  { path: "/admin/account/password/reset", limit: 15 },
  { path: CHANGE_PASSWORD_PATH, limit: 10 }
] as const;

let mongo: MongoMemoryReplSet | undefined;
let server: Server | undefined;
let baseUrl: string;
let accountId: string;
let sessionCookie: string;
let csrfToken: string;

const request = async (
  path: string,
  method: string,
  body?: Record<string, unknown>,
  headers: Record<string, string> = {}
) => {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    status: response.status,
    body: method === "HEAD" ? null : ((await response.json()) as Record<string, unknown>),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    setCookie: response.headers.get("set-cookie"),
    retryAfter: response.headers.get("retry-after")
  };
};

const browserHeaders = () => ({ Origin: ORIGIN, Cookie: sessionCookie, "X-CSRF-Token": csrfToken });

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.ALLOWED_ORIGINS = ORIGIN;
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.AUTH_TENANT_TOKEN = SERVICE_TOKEN;
  delete process.env.SUPER_ADMIN_ID;
  delete process.env.SUPER_ADMIN_EMAIL;
  delete process.env.SUPER_ADMIN_PASSWORD;

  mongo = await MongoMemoryReplSet.create({
    binary: { version: "7.0.24" },
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  await mongoose.connect(mongo.getUri("p01_auth_test"));
  const { default: app } = await import("../app");
  const { default: AccountAdmin } = await import("../models/account-admin.model");
  const passwordHash = await bcrypt.hash(ACCOUNT_PASSWORD, 10);
  const account = await AccountAdmin.create({
    fullName: "Auth Regression",
    email: ACCOUNT_EMAIL,
    password: passwordHash,
    status: "active",
    platformRole: "user"
  });
  accountId = account.id;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const login = await request(
    LOGIN_PATH,
    "POST",
    { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD },
    { Origin: ORIGIN }
  );
  assert.equal(login.status, 200);
  assert.ok(login.cookie);
  assert.ok(login.cookie.startsWith("tokenAdmin="));
  assert.ok(login.body && typeof login.body.csrfToken === "string");
  sessionCookie = login.cookie;
  csrfToken = login.body.csrfToken;
}, { timeout: 90000 });

beforeEach(async () => {
  await mongoose.connection.db?.collection("rate_limits").deleteMany({});
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});

test("login keeps the existing cookie and response contract", async () => {
  const valid = await request(
    LOGIN_PATH,
    "POST",
    { email: ACCOUNT_EMAIL, password: ACCOUNT_PASSWORD },
    { Origin: ORIGIN }
  );
  assert.equal(valid.status, 200);
  assert.equal(valid.body?.code, "success");
  assert.ok(valid.cookie?.startsWith("tokenAdmin="));
  assert.match(valid.setCookie || "", /HttpOnly/);
  assert.equal(typeof valid.body?.csrfToken, "string");
  assert.equal(valid.body?.token, undefined);

  const invalid = await request(
    LOGIN_PATH,
    "POST",
    { email: ACCOUNT_EMAIL, password: "incorrect" },
    { Origin: ORIGIN }
  );
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body?.code, "error");
  assert.equal(invalid.cookie, undefined);
});

test("introspection requires the service credential and a verified current cookie", async () => {
  const validHeaders = {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    Cookie: sessionCookie
  };
  const valid = await request(INTROSPECT_PATH, "POST", {}, validHeaders);
  assert.equal(valid.status, 200);
  assert.equal(valid.body?.code, "success");
  assert.equal((valid.body?.account as Record<string, unknown>)?.id, accountId);
  assert.equal(valid.body?.token, undefined);
  assert.equal(valid.cookie, undefined);

  const missingService = await request(INTROSPECT_PATH, "POST", {}, { Cookie: sessionCookie });
  assert.equal(missingService.status, 401);
  const wrongService = await request(INTROSPECT_PATH, "POST", {}, {
    Cookie: sessionCookie,
    Authorization: "Bearer wrong"
  });
  assert.equal(wrongService.status, 401);

  const spoofed = await request(INTROSPECT_PATH, "POST", { userId: accountId }, {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    "X-User-Id": accountId,
    "X-Tenant-Id": accountId
  });
  assert.equal(spoofed.status, 401);
  const invalidCookie = await request(INTROSPECT_PATH, "POST", {}, {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    Cookie: "tokenAdmin=invalid"
  });
  assert.equal(invalidCookie.status, 401);

  const claims = jwt.decode(sessionCookie.slice("tokenAdmin=".length));
  assert.ok(claims && typeof claims !== "string");
  const expiredToken = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 1 }, JWT_SECRET, {
    algorithm: "HS256"
  });
  const expired = await request(INTROSPECT_PATH, "POST", {}, {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    Cookie: `tokenAdmin=${expiredToken}`
  });
  assert.equal(expired.status, 401);
});

test("disabled accounts cannot reuse an existing session", async () => {
  const { default: AccountAdmin } = await import("../models/account-admin.model");
  await AccountAdmin.updateOne({ _id: accountId }, { $set: { status: "inactive" } });
  try {
    const denied = await request(ME_PATH, "GET", undefined, { Cookie: sessionCookie });
    assert.equal(denied.status, 401);
  } finally {
    await AccountAdmin.updateOne({ _id: accountId }, { $set: { status: "active" } });
  }
});

test("Origin and CSRF reject invalid writes while safe methods keep working", async () => {
  const invalidOrigin = await request(LOGIN_PATH, "POST", {}, { Origin: OTHER_ORIGIN });
  assert.equal(invalidOrigin.status, 403);
  const missingOrigin = await request(LOGIN_PATH, "POST", {});
  assert.equal(missingOrigin.status, 403);

  const missingCsrf = await request(CHANGE_PASSWORD_PATH, "POST", {}, {
    Origin: ORIGIN,
    Cookie: sessionCookie
  });
  assert.equal(missingCsrf.status, 403);
  const wrongCsrf = await request(CHANGE_PASSWORD_PATH, "POST", {}, {
    Origin: ORIGIN,
    Cookie: sessionCookie,
    "X-CSRF-Token": "wrong"
  });
  assert.equal(wrongCsrf.status, 403);
  assert.equal(await mongoose.connection.db?.collection("rate_limits").countDocuments({}), 0);

  const me = await request(ME_PATH, "GET", undefined, { Cookie: sessionCookie });
  assert.equal(me.status, 200);
  assert.equal(me.body?.code, "success");
  const head = await request(ME_PATH, "HEAD", undefined, { Cookie: sessionCookie });
  assert.equal(head.status, 200);
  const options = await fetch(baseUrl + LOGIN_PATH, { method: "OPTIONS" });
  assert.equal(options.status, 204);
});

RATE_CASES.forEach(({ path, limit }) => {
  test(`malformed ${path} requests count toward the existing limit`, async () => {
    const headers = path === CHANGE_PASSWORD_PATH ? browserHeaders() : { Origin: ORIGIN };
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const underLimit = await request(path, "POST", {}, headers);
      assert.equal(underLimit.status, 400);
      assert.equal(underLimit.body?.code, "error");
    }
    const overLimit = await request(path, "POST", {}, headers);
    assert.equal(overLimit.status, 429);
    assert.equal(overLimit.body?.code, "error");
    assert.equal(overLimit.body?.message, "Quá nhiều yêu cầu, vui lòng thử lại sau!");
    assert.equal(overLimit.retryAfter, "900");
  });
});
