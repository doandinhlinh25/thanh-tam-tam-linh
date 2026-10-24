import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn, ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve, join, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import argon2 from "argon2";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const jwt = createRequire(resolve("services/auth-service/package.json"))("jsonwebtoken");
const jwtSecret = "test-jwt-signing-secret-with-at-least-32-characters";

const origin = "http://localhost:3000";
const serviceKey = "test-auth-tenant-credential-32-characters";
const documentKey = "test-document-credential-32-characters";
const chatKey = "test-chat-credential-32-characters";
const password = "Demo-password-2026!";
const processes: ChildProcess[] = [];
const output: string[] = [];
const messages: string[] = [];
const users: Record<string, any> = {};
const sessions: Record<string, any> = {};
const testDataRoot = resolve(".test-data");
let mongoDataPath: string | undefined;
let mongo: MongoMemoryReplSet;
let authDb: mongoose.Connection;
let tenantDb: mongoose.Connection;
let authUrl: string;
let tenantUrl: string;
let tenantA: string;
let tenantB: string;
let courseA: string;
let courseHidden: string;

const smtp = createServer((socket) => {
  socket.write("220 localhost test-smtp\r\n");
  let buffer = "",
    dataMode = false;
  let lines: string[] = [];
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    let end: number;
    while ((end = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (dataMode) {
        if (line === ".") {
          messages.push(lines.join("\r\n"));
          lines = [];
          dataMode = false;
          socket.write("250 accepted\r\n");
        } else lines.push(line);
      } else if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
      else if (/^MAIL|^RCPT|^RSET|^NOOP/.test(line)) socket.write("250 OK\r\n");
      else if (line === "DATA") {
        dataMode = true;
        socket.write("354 send message\r\n");
      } else if (line === "QUIT") socket.end("221 bye\r\n");
      else socket.write("502 unsupported\r\n");
    }
  });
});

const freePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
};

const request = async (
  base: string,
  method: string,
  path: string,
  body?: unknown,
  user?: any,
  extra: Record<string, string> = {}
) => {
  const headers: Record<string, string> = { Origin: origin, ...extra };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (user?.cookie) headers.Cookie = user.cookie;
  if (user?.csrfToken) headers["X-CSRF-Token"] = user.csrfToken;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json();
  return {
    status: response.status,
    body: result as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    setCookie: response.headers.get("set-cookie")
  };
};

const login = async (name: string) => {
  const result = await request(authUrl, "POST", "/admin/account/login", {
    email: users[name].email,
    password
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.code, "success");
  return { cookie: result.cookie, csrfToken: result.body.csrfToken };
};

const tokenFromMail = (email: string, route: string) => {
  const message = [...messages]
    .reverse()
    .find((item) => item.includes(email) && item.includes(route));
  assert.ok(message, "Expected local SMTP message");
  const decoded = message
    .replace(/=\r\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_all, hex) => String.fromCharCode(parseInt(hex, 16)));
  const token = decoded.match(/#token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(token, "Message must contain one opaque token");
  return token;
};

const startService = async (
  service: string,
  url: string,
  port: number,
  uri: string,
  smtpPort: number
) => {
  const child = spawn(process.execPath, ["--import", "tsx", "index.ts"], {
    cwd: resolve("services", service),
    env: {
      ...process.env,
      NODE_ENV: "test",
      JWT_SECRET: jwtSecret,
      PORT: String(port),
      MONGODB_URI: uri,
      ALLOWED_ORIGINS: origin,
      AUTH_SERVICE_URL: authUrl,
      AUTH_TENANT_TOKEN: serviceKey,
      DOCUMENT_SERVICE_TOKEN: documentKey,
      CHAT_SERVICE_TOKEN: chatKey,
      ...(service === "auth-service"
        ? {
            SUPER_ADMIN_ID: "aaaaaaaaaaaaaaaaaaaaaaaa",
            SUPER_ADMIN_EMAIL: "super-admin@example.com",
            SUPER_ADMIN_PASSWORD: "Super-admin-test-password-2026!"
          }
        : {}),
      APP_URL: origin,
      SMTP_URL: "smtp://127.0.0.1:" + smtpPort,
      MAIL_FROM: "platform@example.com"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  processes.push(child);
  child.stdout?.on("data", (data) => output.push(String(data)));
  child.stderr?.on("data", (data) => output.push(String(data)));
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(service + " exited: " + output.join("\n"));
    try {
      const response = await fetch(url + "/health/ready", { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(service + " did not become ready: " + output.join("\n"));
};

before(
  async () => {
    await mkdir(testDataRoot, { recursive: true });
    mongoDataPath = await mkdtemp(join(testDataRoot, "jwt-"));
    mongo = await MongoMemoryReplSet.create({
      instanceOpts: [{ dbPath: mongoDataPath, args: ["--wiredTigerCacheSizeGB", "0.25"] }],
      binary: { version: "7.0.24" },
      replSet: { count: 1, storageEngine: "wiredTiger" }
    });
    authDb = await mongoose.createConnection(mongo.getUri("auth_test")).asPromise();
    tenantDb = await mongoose.createConnection(mongo.getUri("tenant_test")).asPromise();
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    for (const name of ["admin", "owner", "lecturer", "student", "outsider", "extra"]) {
      users[name] = {
        _id: new mongoose.Types.ObjectId(),
        email: name + "@example.com",
        fullName: name,
        password: hash,
        platformRole: name === "admin" ? "platform_admin" : "user",
        status: "active",
        emailVerifiedAt: new Date(),
        deleted: false,
        authVersion: 0
      };
    }
    await authDb.collection("accounts-admin").insertMany(Object.values(users));
    smtp.listen(0, "127.0.0.1");
    await once(smtp, "listening");
    const smtpPort = (smtp.address() as { port: number }).port;
    const authPort = await freePort(),
      tenantPort = await freePort();
    authUrl = "http://127.0.0.1:" + authPort;
    tenantUrl = "http://127.0.0.1:" + tenantPort;
    await startService("auth-service", authUrl, authPort, mongo.getUri("auth_test"), smtpPort);
    await startService(
      "tenant-service",
      tenantUrl,
      tenantPort,
      mongo.getUri("tenant_test"),
      smtpPort
    );
    for (const name of ["admin", "owner", "lecturer", "student", "outsider"])
      sessions[name] = await login(name);
  },
  { timeout: 90000 }
);

beforeEach(async () => {
  await authDb.collection("rate_limits").deleteMany({});
});

after(async () => {
  await Promise.all(
    processes.map(async (child) => {
      if (child.exitCode !== null) return;
      const exited = once(child, "exit");
      child.kill();
      await exited;
    })
  );
  await authDb?.close();
  await tenantDb?.close();
  if (smtp.listening) await new Promise<void>((done) => smtp.close(() => done()));
  await mongo?.stop();
  if (mongoDataPath) {
    assert.ok(resolve(mongoDataPath).startsWith(testDataRoot + sep), "Unsafe test cleanup path");
    await rm(mongoDataPath, { recursive: true, force: true });
  }
});

test("Super Admin: env login, middleware permissions, no AccountAdmin document and normal login fallback", async () => {
  const email = "super-admin@example.com";
  const superPassword = "Super-admin-test-password-2026!";
  const superId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  assert.equal(
    await authDb
      .collection("accounts-admin")
      .countDocuments({ _id: new mongoose.Types.ObjectId(superId) }),
    0
  );

  const signedIn = await request(authUrl, "POST", "/admin/account/login", {
    email: " SUPER-ADMIN@EXAMPLE.COM ",
    password: superPassword,
    rememberPassword: true
  });
  assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
  assert.equal(signedIn.body.code, "success");
  assert.ok(signedIn.cookie);
  assert.ok(signedIn.body.csrfToken);
  assert.equal(signedIn.body.token, undefined);

  const superSession = { cookie: signedIn.cookie, csrfToken: signedIn.body.csrfToken };
  const me = await request(authUrl, "GET", "/admin/account/me", undefined, superSession);
  assert.equal(me.status, 200);
  assert.equal(me.body.account.id, superId);
  assert.equal(me.body.account.email, email);
  assert.equal(me.body.account.fullName, "SuperAdmin");
  assert.equal(me.body.account.isSuperAdmin, true);
  assert.equal(me.body.account.platformRole, "platform_admin");
  assert.equal(me.body.account.password, undefined);

  const wrong = await request(authUrl, "POST", "/admin/account/login", {
    email,
    password: "wrong-password"
  });
  assert.equal(wrong.status, 401);
  const fake = await request(authUrl, "GET", "/admin/account-admin/list", undefined, undefined, {
    "x-user-id": superId,
    "x-is-super-admin": "true"
  });
  assert.equal(fake.status, 401);

  const list = await request(authUrl, "GET", "/admin/account-admin/list", undefined, superSession);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const created = await request(
    authUrl,
    "POST",
    "/admin/account-admin/create",
    {
      fullName: "Future Admin",
      email: "future-admin@example.com",
      password,
      confirmPassword: password,
      status: "initial"
    },
    superSession
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.account.password, undefined);

  const reserved = await request(
    authUrl,
    "POST",
    "/admin/account-admin/create",
    {
      fullName: "Duplicate Super",
      email,
      password,
      confirmPassword: password,
      status: "active"
    },
    superSession
  );
  assert.equal(reserved.status, 409);

  const change = await request(
    authUrl,
    "POST",
    "/admin/account/change-password",
    {
      password: superPassword,
      newPassword: password,
      confirmPassword: password
    },
    superSession
  );
  assert.equal(change.status, 403);

  const tenant = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/create",
    {
      name: "Super-owned tenant",
      code: "super-owned"
    },
    superSession
  );
  assert.equal(tenant.status, 200, JSON.stringify(tenant.body));
  const membership = await tenantDb.collection("tenant_memberships").findOne({
    tenantId: new mongoose.Types.ObjectId(tenant.body.tenant._id),
    userId: new mongoose.Types.ObjectId(superId)
  });
  assert.equal(membership?.role, "tenant_owner");
  assert.equal(
    await authDb.collection("accounts-admin").countDocuments({
      $or: [{ _id: new mongoose.Types.ObjectId(superId) }, { email }]
    }),
    0
  );

  const ordinary = await request(authUrl, "GET", "/admin/account/me", undefined, sessions.owner);
  assert.equal(ordinary.status, 200);
  assert.equal(ordinary.body.account.isSuperAdmin, false);
  assert.equal(
    (await request(authUrl, "GET", "/admin/account-admin/list", undefined, sessions.owner)).status,
    403
  );
  assert.equal(
    (await request(authUrl, "POST", "/admin/account/logout", {}, superSession)).status,
    200
  );
  assert.equal(
    (await request(authUrl, "GET", "/admin/account/me", undefined, superSession)).status,
    200
  );
});

test("JWT: duy-tam login/logout, bcrypt, expiry, signature and privilege checks", async () => {
  const signedIn = await request(authUrl, "POST", "/admin/account/login", {
    email: "super-admin@example.com",
    password: "Super-admin-test-password-2026!",
    rememberPassword: "true"
  });
  assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
  const token = signedIn.cookie!.slice("tokenAdmin=".length);
  const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] }) as any;
  assert.equal(payload.id, "aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(payload.email, "super-admin@example.com");
  assert.equal(payload.exp - payload.iat, 7 * 86400);
  assert.equal(jwt.decode(token, { complete: true }).header.alg, "HS256");
  assert.ok(signedIn.setCookie?.includes("HttpOnly"));
  assert.ok(signedIn.setCookie?.includes("SameSite=Strict"));
  assert.ok(signedIn.setCookie?.includes("Max-Age=604800"));
  assert.ok(!JSON.stringify(payload).includes("Super-admin-test-password-2026!"));
  assert.equal(await authDb.collection("sessions").countDocuments({}), 0);

  const account = await request(
    authUrl,
    "POST",
    "/admin/account-admin/create",
    {
      fullName: "JWT Admin",
      email: "jwt-admin@example.com",
      password,
      confirmPassword: password,
      status: "active"
    },
    sessions.admin
  );
  assert.equal(account.status, 200, JSON.stringify(account.body));
  const stored = await authDb
    .collection("accounts-admin")
    .findOne({ email: "jwt-admin@example.com" });
  assert.match(stored!.password, /^\$2[aby]\$10\$/);
  assert.equal(stored!.emailVerifiedAt, null);
  const normal = await request(authUrl, "POST", "/admin/account/login", {
    email: "jwt-admin@example.com",
    password,
    rememberPassword: "false"
  });
  assert.equal(normal.status, 200, JSON.stringify(normal.body));
  const normalToken = normal.cookie!.slice("tokenAdmin=".length);
  const claims = jwt.verify(normalToken, jwtSecret, { algorithms: ["HS256"] }) as any;
  assert.equal(claims.exp - claims.iat, 86400);
  assert.equal(claims.isSuperAdmin, false);
  const normalUser = { cookie: normal.cookie, csrfToken: normal.body.csrfToken };
  const csrf = await request(authUrl, "GET", "/admin/account/csrf", undefined, normalUser);
  assert.equal(csrf.body.csrfToken, normalUser.csrfToken);

  // Claim platformRole không được phép tự nâng quyền của tài khoản database.
  const elevated = jwt.sign({ ...claims, platformRole: "platform_admin" }, jwtSecret, {
    algorithm: "HS256"
  });
  assert.equal(
    (
      await request(authUrl, "GET", "/admin/account-admin/list", undefined, {
        cookie: "tokenAdmin=" + elevated
      })
    ).status,
    403
  );
  const invalidTokens = [
    token
      .split(".")
      .map((part: string, index: number) =>
        index === 2 ? (part[0] === "A" ? "B" : "A") + part.slice(1) : part
      )
      .join("."),
    jwt.sign({ ...claims }, "wrong-jwt-key-not-the-test-key", { algorithm: "HS256" }),
    jwt.sign({ ...claims }, null, { algorithm: "none" }),
    jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }, jwtSecret, {
      algorithm: "HS256"
    }),
    jwt.sign({ ...claims, isSuperAdmin: true }, jwtSecret, { algorithm: "HS256" })
  ];
  for (const invalid of invalidTokens) {
    assert.equal(
      (
        await request(authUrl, "GET", "/admin/account/me", undefined, {
          cookie: "tokenAdmin=" + invalid
        })
      ).status,
      401
    );
  }

  const logout = await request(authUrl, "POST", "/admin/account/logout", undefined, normalUser);
  assert.equal(logout.status, 200);
  assert.equal(logout.cookie, "tokenAdmin=");
  assert.ok(logout.setCookie?.includes("Expires=Thu, 01 Jan 1970"));
  // Như nhánh gốc: logout xóa cookie browser, không lưu blacklist JWT phía server.
  assert.equal(
    (await request(authUrl, "GET", "/admin/account/me", undefined, normalUser)).status,
    200
  );
  assert.equal(
    (
      await request(authUrl, "POST", "/admin/account/logout", undefined, {
        cookie: "tokenAdmin=expired-token"
      })
    ).status,
    200
  );
  assert.equal((await request(authUrl, "POST", "/admin/account/logout")).status, 200);
});

test("Auth: cookie/JWT, generic login failure, Origin and password-hash serialization", async () => {
  const me = await request(authUrl, "GET", "/admin/account/me", undefined, sessions.owner);
  assert.equal(me.status, 200);
  assert.equal(me.body.account.email, users.owner.email);
  assert.equal(me.body.account.password, undefined);
  assert.equal(me.body.account.csrfHash, undefined);
  const wrong = await request(authUrl, "POST", "/admin/account/login", {
    email: users.owner.email,
    password: "wrong"
  });
  const missing = await request(authUrl, "POST", "/admin/account/login", {
    email: "missing@example.com",
    password: "wrong"
  });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, missing.body);
  const forbidden = await request(
    authUrl,
    "POST",
    "/admin/account/login",
    { email: users.owner.email, password },
    undefined,
    { Origin: "https://attacker.test" }
  );
  assert.equal(forbidden.status, 403);
  const created = await request(
    authUrl,
    "POST",
    "/admin/account-admin/create",
    {
      fullName: "Created Account",
      email: "created@example.com",
      password,
      confirmPassword: password,
      status: "initial"
    },
    sessions.admin
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.account.password, undefined);
  assert.equal(created.body.account.authVersion, undefined);
});

test("Tenant: create owner atomically, reject fake identity, invalid input and absent CSRF", async () => {
  const make = async (code: string, ownerId: string) => {
    const result = await request(
      tenantUrl,
      "POST",
      "/admin/tenant/create",
      {
        name: code,
        code,
        ownerId,
        quota: { maxDailyChats: 2 }
      },
      sessions.admin
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.tenant._id;
  };
  tenantA = await make("tenant-a", String(users.owner._id));
  tenantB = await make("tenant-b", String(users.outsider._id));
  assert.equal(
    await tenantDb
      .collection("tenant_memberships")
      .countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantA), role: "tenant_owner" }),
    1
  );
  const forged = await request(tenantUrl, "GET", "/admin/tenant/list", undefined, undefined, {
    "x-user-id": String(users.admin._id),
    "x-role": "platform_admin"
  });
  assert.equal(forged.status, 401);
  const noCsrf = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/create",
    { name: "Bad" },
    { cookie: sessions.admin.cookie }
  );
  assert.equal(noCsrf.status, 403);
  assert.equal(
    (await request(tenantUrl, "GET", "/admin/tenant/list?page=-1", undefined, sessions.admin))
      .status,
    400
  );
  assert.equal(
    (await request(tenantUrl, "GET", "/admin/tenant/detail/not-an-id", undefined, sessions.admin))
      .status,
    400
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "POST",
        "/admin/tenant/create",
        { name: "Bad", quota: { maxUsers: -1 } },
        sessions.admin
      )
    ).status,
    400
  );
});

test("Tenant: member list, owner settings, student/course ACL and Document authorization", async () => {
  for (const [name, role] of [
    ["lecturer", "lecturer"],
    ["student", "student"]
  ]) {
    const result = await request(
      tenantUrl,
      "POST",
      "/admin/tenant/" + tenantA + "/members/add",
      { userId: String(users[name]._id), role },
      sessions.owner
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  const courses: string[] = [];
  for (const code of ["CS101", "CS102"]) {
    const result = await request(
      tenantUrl,
      "POST",
      "/admin/tenant/" + tenantA + "/courses/create",
      { name: code, code },
      sessions.owner
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.course.status, "active");
    courses.push(result.body.course._id);
  }
  [courseA, courseHidden] = courses;
  for (const [name, action] of [
    ["lecturer", "assign-lecturer"],
    ["student", "enroll"]
  ]) {
    const result = await request(
      tenantUrl,
      "POST",
      "/admin/tenant/" + tenantA + "/courses/" + courseA + "/" + action,
      { userId: String(users[name]._id) },
      sessions.owner
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  const own = await request(
    tenantUrl,
    "GET",
    "/admin/tenant/my-tenants",
    undefined,
    sessions.student
  );
  assert.equal(own.body.tenants.length, 1);
  const list = await request(
    tenantUrl,
    "GET",
    "/admin/tenant/" + tenantA + "/courses/list",
    undefined,
    sessions.student
  );
  assert.deepEqual(
    list.body.courses.map((item: any) => item._id),
    [courseA]
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "GET",
        "/admin/tenant/" + tenantA + "/courses/detail/" + courseHidden,
        undefined,
        sessions.student
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "GET",
        "/admin/tenant/" + tenantB + "/courses/detail/" + courseA,
        undefined,
        sessions.outsider
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "PATCH",
        "/admin/tenant/" + tenantA + "/settings",
        { name: "Updated tenant" },
        sessions.owner
      )
    ).status,
    200
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "PATCH",
        "/admin/tenant/" + tenantA + "/settings",
        { quota: { maxUsers: 1000 } },
        sessions.owner
      )
    ).status,
    400
  );
  const doc = (user: any, courseId: string) =>
    request(tenantUrl, "POST", "/internal/authorization/course", { courseId }, user, {
      Authorization: "Bearer " + documentKey
    });
  assert.equal((await doc(sessions.lecturer, courseA)).status, 200);
  assert.equal((await doc(sessions.lecturer, courseHidden)).status, 403);
  assert.equal((await doc(sessions.student, courseA)).status, 403);
  assert.equal((await doc(sessions.admin, courseA)).status, 403);
  assert.equal(
    (
      await request(
        tenantUrl,
        "POST",
        "/internal/authorization/course",
        { courseId: courseA },
        sessions.lecturer
      )
    ).status,
    401
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "PATCH",
        "/admin/tenant/" + tenantA + "/courses/edit/" + courseA,
        { name: "Changed course" },
        sessions.owner
      )
    ).status,
    200
  );
});

test("Quota: concurrent requests respect limit; retries are idempotent and bound to user/course", async () => {
  const ids = Array.from({ length: 8 }, () => randomUUID());
  const consume = (requestId: string, user = sessions.student) =>
    request(
      tenantUrl,
      "POST",
      "/internal/quota/chat/consume",
      { tenantId: tenantA, courseId: courseA, requestId },
      user,
      { Authorization: "Bearer " + chatKey }
    );
  const results = await Promise.all(ids.map((id) => consume(id)));
  assert.equal(
    results.filter((item) => item.status === 200).length,
    2,
    JSON.stringify(results.map((item) => item.body))
  );
  assert.equal(results.filter((item) => item.status === 409).length, 6);
  const successfulId = ids[results.findIndex((item) => item.status === 200)];
  const replay = await consume(successfulId);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.consumed, false);
  assert.equal((await consume(successfulId, sessions.owner)).status, 409);
  const usage = await tenantDb
    .collection("daily_usage")
    .findOne({ tenantId: new mongoose.Types.ObjectId(tenantA) });
  assert.equal(usage?.chatCount, 2);
});

test("Membership: protect final owner; revoke immediately and clear enrollment before restore", async () => {
  const owner = await tenantDb
    .collection("tenant_memberships")
    .findOne({ tenantId: new mongoose.Types.ObjectId(tenantA), role: "tenant_owner" });
  const student = await tenantDb
    .collection("tenant_memberships")
    .findOne({ tenantId: new mongoose.Types.ObjectId(tenantA), userId: users.student._id });
  assert.equal(
    (
      await request(
        tenantUrl,
        "PATCH",
        "/admin/tenant/" + tenantA + "/members/" + owner!._id + "/revoke",
        {},
        sessions.owner
      )
    ).status,
    409
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "PATCH",
        "/admin/tenant/" + tenantA + "/members/" + student!._id + "/role",
        { role: "tenant_owner" },
        sessions.student
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "PATCH",
        "/admin/tenant/" + tenantA + "/members/" + student!._id + "/revoke",
        {},
        sessions.owner
      )
    ).status,
    200
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "GET",
        "/admin/tenant/" + tenantA + "/courses/list",
        undefined,
        sessions.student
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "POST",
        "/admin/tenant/" + tenantA + "/members/add",
        { userId: String(users.student._id), role: "student" },
        sessions.owner
      )
    ).status,
    200
  );
  assert.equal(
    (
      await request(
        tenantUrl,
        "GET",
        "/admin/tenant/" + tenantA + "/courses/detail/" + courseA,
        undefined,
        sessions.student
      )
    ).status,
    403
  );
});

test("Invitations: activation, exact recipient, one-use token, resend invalidates previous token", async () => {
  const recipient = "invited@example.com";
  const created = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/" + tenantA + "/invitations/create",
    { email: recipient.toUpperCase(), role: "student" },
    sessions.owner
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.invitation.tokenHash, undefined);
  const actionToken = tokenFromMail(recipient, "/reset-password");
  const inviteToken = tokenFromMail(recipient, "/accept-invitation");
  const wrongRecipient = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/invitations/accept",
    { token: inviteToken },
    sessions.outsider
  );
  assert.equal(wrongRecipient.status, 403);
  const activate = await request(authUrl, "POST", "/admin/account/password/reset", {
    token: actionToken,
    password,
    confirmPassword: password
  });
  assert.equal(activate.status, 200, JSON.stringify(activate.body));
  assert.equal(
    (
      await request(authUrl, "POST", "/admin/account/password/reset", {
        token: actionToken,
        password,
        confirmPassword: password
      })
    ).status,
    400
  );
  const signedIn = await request(authUrl, "POST", "/admin/account/login", {
    email: recipient,
    password
  });
  const invitedSession = { cookie: signedIn.cookie, csrfToken: signedIn.body.csrfToken };
  const accepted = await Promise.all(
    [1, 2].map(() =>
      request(
        tenantUrl,
        "POST",
        "/admin/tenant/invitations/accept",
        { token: inviteToken },
        invitedSession
      )
    )
  );
  assert.equal(accepted.filter((item) => item.status === 200).length, 1, JSON.stringify(accepted));
  const recipient2 = "resend@example.com";
  const next = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/" + tenantA + "/invitations/create",
    { email: recipient2, role: "student" },
    sessions.owner
  );
  assert.equal(next.status, 200, JSON.stringify(next.body));
  const oldToken = tokenFromMail(recipient2, "/accept-invitation");
  const resent = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/" + tenantA + "/invitations/" + next.body.invitation.id + "/resend",
    {},
    sessions.owner
  );
  assert.equal(resent.status, 200, JSON.stringify(resent.body));
  assert.notEqual(tokenFromMail(recipient2, "/accept-invitation"), oldToken);
  const old = await tenantDb
    .collection("tenant_invitations")
    .findOne({ tokenHash: createHash("sha256").update(oldToken).digest("hex") });
  assert.equal(old?.status, "revoked");
  const list = await request(
    tenantUrl,
    "GET",
    "/admin/tenant/" + tenantA + "/invitations/list?limit=1",
    undefined,
    sessions.owner
  );
  assert.equal(list.body.invitations.length, 1);
  assert.equal(list.body.invitations[0].tokenHash, undefined);
  assert.ok(list.body.pagination.total >= 3);
});

test("Auth regression: profile search, active invitations and forgot do not revoke JWT", async () => {
  const email = "regression-active@example.com";
  const created = await request(
    authUrl,
    "POST",
    "/admin/account-admin/create",
    {
      fullName: "Before Rename",
      email,
      password,
      confirmPassword: password,
      status: "active"
    },
    sessions.admin
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const account = await authDb.collection("accounts-admin").findOne({ email });
  const loggedIn = await request(authUrl, "POST", "/admin/account/login", { email, password });
  assert.equal(loggedIn.status, 200);
  const user = { cookie: loggedIn.cookie, csrfToken: loggedIn.body.csrfToken };
  const edit = await request(
    authUrl,
    "PATCH",
    "/admin/account-admin/edit/" + account!._id,
    {
      fullName: "Regression Search Name"
    },
    sessions.admin
  );
  assert.equal(edit.status, 200);
  assert.equal((await request(authUrl, "GET", "/admin/account/me", undefined, user)).status, 200);
  const list = await request(
    authUrl,
    "GET",
    "/admin/account-admin/list?keyword=Regression%20Search",
    undefined,
    sessions.admin
  );
  assert.ok(list.body.adminList.some((item: any) => item.email === email));
  const mailCount = messages.length;
  const provision = await request(
    authUrl,
    "POST",
    "/internal/account/provision",
    { email },
    undefined,
    {
      Authorization: "Bearer " + serviceKey
    }
  );
  assert.equal(provision.status, 200, JSON.stringify(provision.body));
  assert.equal(messages.length, mailCount);
  const activation = await request(
    authUrl,
    "POST",
    "/admin/account-admin/" + account!._id + "/send-activation",
    {},
    sessions.admin
  );
  assert.equal(activation.status, 409);
  const forgot = await request(authUrl, "POST", "/admin/account/password/forgot", { email });
  assert.equal(forgot.status, 200);
  assert.ok(tokenFromMail(email, "/reset-password"));
  assert.equal((await request(authUrl, "GET", "/admin/account/me", undefined, user)).status, 200);
});

test("Tenant regression: full member quota blocks invitations and multipart fields are bounded", async () => {
  const created = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/create",
    {
      name: "Full Tenant",
      code: "full-tenant",
      ownerId: String(users.owner._id),
      quota: { maxUsers: 1 }
    },
    sessions.admin
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const tenantId = created.body.tenant._id;
  const invite = await request(
    tenantUrl,
    "POST",
    "/admin/tenant/" + tenantId + "/invitations/create",
    {
      email: "quota-blocked@example.com",
      role: "student"
    },
    sessions.owner
  );
  assert.equal(invite.status, 409, JSON.stringify(invite.body));
  assert.equal(
    await tenantDb.collection("tenant_invitations").countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: "pending"
    }),
    0
  );
  const form = new FormData();
  form.append("name", "x".repeat(33 * 1024));
  const response = await fetch(tenantUrl + "/admin/tenant/" + tenantId + "/settings", {
    method: "PATCH",
    headers: {
      Origin: origin,
      Cookie: sessions.owner.cookie,
      "X-CSRF-Token": sessions.owner.csrfToken
    },
    body: form
  });
  assert.equal(response.status, 400);
});

test("Auth JWT: logout clears cookie; expiry/reset invalidate JWT; malformed JSON returns 400", async () => {
  const temporary = await login("outsider");
  assert.equal(
    (await request(authUrl, "POST", "/admin/account/logout", {}, temporary)).status,
    200
  );
  assert.equal(
    (await request(authUrl, "GET", "/admin/account/me", undefined, temporary)).status,
    200
  );
  const expires = await login("outsider");
  const token = expires.cookie!.slice("tokenAdmin=".length);
  const claims = jwt.decode(token);
  expires.cookie =
    "tokenAdmin=" +
    jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }, jwtSecret, {
      algorithm: "HS256"
    });
  assert.equal(
    (await request(authUrl, "GET", "/admin/account/me", undefined, expires)).status,
    401
  );
  const known = await request(authUrl, "POST", "/admin/account/password/forgot", {
    email: users.owner.email
  });
  const unknown = await request(authUrl, "POST", "/admin/account/password/forgot", {
    email: "unknown@example.com"
  });
  assert.deepEqual(known.body, unknown.body);
  const reset = tokenFromMail(users.owner.email, "/reset-password");
  const results = await Promise.all(
    [1, 2].map(() =>
      request(authUrl, "POST", "/admin/account/password/reset", {
        token: reset,
        password: "Changed-password-2026!",
        confirmPassword: "Changed-password-2026!"
      })
    )
  );
  assert.equal(results.filter((item) => item.status === 200).length, 1);
  assert.equal(
    (await request(authUrl, "GET", "/admin/account/me", undefined, sessions.owner)).status,
    401
  );
  const malformed = await fetch(authUrl + "/admin/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: "{"
  });
  assert.equal(malformed.status, 400);
  const audit = await authDb.collection("auth_audit_logs").find({}).toArray();
  assert.ok(audit.length > 0);
  assert.ok(audit.every((row) => !row.password && !row.token && !row.email));
});
