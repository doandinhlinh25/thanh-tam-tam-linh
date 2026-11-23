import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve, join, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import argon2 from "argon2";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";

const jwt = createRequire(resolve("services/auth-service/package.json"))("jsonwebtoken");
const OTPAuth = createRequire(resolve("services/auth-service/package.json"))("otpauth");
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
  smtpPort: number,
  overrides: Record<string, string> = {}
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
      AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      AUTH_MFA_KEY_ID: "test-key",
      AUTH_MFA_ISSUER: "Thanh Tam Test",
      SMTP_URL: "smtp://127.0.0.1:" + smtpPort,
      MAIL_FROM: "platform@example.com",
      ...overrides
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
      if (response.ok) return child;
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(service + " did not become ready: " + output.join("\n"));
};

before(
  async () => {
    await mkdir(testDataRoot, { recursive: true });
    mongoDataPath = await mkdtemp(join(testDataRoot, "features-"));
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
      if (child.exitCode !== null || child.signalCode !== null) return;
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

const api = (
  method: string,
  path: string,
  body?: unknown,
  user?: any,
  extra: Record<string, string> = {}
) => request(authUrl, method, "/api/v1/auth" + path, body, user, extra);
const asSession = (result: any) => ({ cookie: result.cookie, csrfToken: result.body.csrfToken });
let superMfaCodes: string[] = [];
const newUser = async (name: string) => {
  users[name] = {
    ...users.owner,
    _id: new mongoose.Types.ObjectId(),
    email: name + "@example.com",
    fullName: name
  };
  await authDb.collection("accounts-admin").insertOne(users[name]);
  return login(name);
};
const otp = (secret: string, offset = 0) =>
  new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30
  }).generate({ timestamp: Date.now() + offset * 1000 });
const enroll = async (user: any, credential = password) => {
  const setup = await api("POST", "/2fa/setup", { password: credential }, user);
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  const enabled = await api(
    "POST",
    "/2fa/enable",
    { setupToken: setup.body.data.setupToken, otp: otp(setup.body.data.secret) },
    user
  );
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
  return {
    user: asSession(enabled),
    codes: enabled.body.data.recoveryCodes as string[],
    secret: setup.body.data.secret
  };
};
const challenge = async (email: string, credential = password, rememberPassword = false) => {
  const response = await api("POST", "/login", { email, password: credential, rememberPassword });
  assert.equal(response.status, 202, JSON.stringify(response.body));
  assert.equal(response.cookie, undefined);
  assert.equal(response.body.csrfToken, undefined);
  return response.body.data.challengeToken as string;
};

test("sessions: legacy denial, owner isolation, current revoke, logout CSRF and server revocation", async () => {
  const first = await newUser("session-user");
  const second = await login("session-user");
  const other = await newUser("session-other");
  const list = await api("GET", "/sessions", undefined, first);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.items.length, 2);
  assert.equal(list.body.data.items.filter((item: any) => item.current).length, 1);
  assert.equal(
    /tokenId|credentialBinding|password|securityVersion/.test(JSON.stringify(list.body)),
    false
  );
  const current = list.body.data.items.find((item: any) => item.current).id;
  assert.equal((await api("DELETE", "/sessions/" + current, undefined, other)).status, 404);
  assert.equal((await api("GET", "/sessions?limit=101", undefined, first)).status, 400);
  assert.equal((await api("DELETE", "/sessions/not-an-id", undefined, first)).status, 400);
  assert.equal((await api("POST", "/logout", {}, { cookie: first.cookie })).status, 403);
  const claims = jwt.decode(first.cookie!.slice("tokenAdmin=".length));
  const legacy = jwt.sign({ ...claims, jti: "A".repeat(43) }, jwtSecret, { algorithm: "HS256" });
  assert.equal(
    (await api("GET", "/me", undefined, { cookie: "tokenAdmin=" + legacy })).status,
    401
  );
  assert.equal((await api("POST", "/logout", {}, second)).status, 200);
  assert.equal((await api("GET", "/me", undefined, second)).status, 401);
  assert.equal((await api("GET", "/me", undefined, first)).status, 200);
  assert.equal(
    (await api("DELETE", "/sessions/" + current, undefined, first)).cookie,
    "tokenAdmin="
  );
  assert.equal((await api("GET", "/me", undefined, first)).status, 401);
  assert.equal((await api("POST", "/logout", {}, { cookie: "tokenAdmin=invalid" })).status, 200);
});

test("logout-all invalidates all sessions through Auth and Tenant without affecting another user", async () => {
  const first = await newUser("all-user");
  const second = await login("all-user");
  const other = await newUser("all-other");
  assert.equal((await api("POST", "/logout-all", { password: "wrong" }, first)).status, 401);
  const result = await api("POST", "/logout-all", { password }, first);
  assert.equal(result.status, 200);
  assert.equal(result.cookie, "tokenAdmin=");
  for (const user of [first, second]) {
    assert.equal((await api("GET", "/me", undefined, user)).status, 401);
    const response = await request(
      tenantUrl,
      "POST",
      "/internal/authorization/context",
      { tenantId: new mongoose.Types.ObjectId().toString() },
      user,
      { Authorization: "Bearer " + chatKey }
    );
    assert.equal(response.status, 401);
    assert.equal(response.body.reasonCode, "SESSION_INVALID");
  }
  assert.equal((await api("GET", "/me", undefined, other)).status, 200);
  assert.equal((await api("GET", "/me", undefined, await login("all-user"))).status, 200);
});

test("profile: both aliases, strict allowlist, metadata and env-backed Super Admin", async () => {
  const user = await newUser("profile-user");
  const updated = await api(
    "PATCH",
    "/profile",
    {
      fullName: "Duy Tam",
      phone: "0900123456",
      description: "Profile",
      avatar: "https://example.com/avatar.png"
    },
    user
  );
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const read = await request(authUrl, "GET", "/admin/account/me", undefined, user);
  assert.equal(read.body.account.fullName, "Duy Tam");
  assert.equal(read.body.account.phone, "0900123456");
  for (const body of [
    { platformRole: "platform_admin" },
    { email: "x@example.com" },
    { userId: users.owner._id.toString() },
    { status: "inactive" },
    { avatar: "http://unsafe.test/a" },
    {}
  ])
    assert.equal((await api("PATCH", "/profile", body, user)).status, 400);
  assert.equal((await api("PATCH", "/profile", { avatar: null }, user)).status, 200);
  assert.match(
    (await authDb.collection("accounts-admin").findOne({ _id: users["profile-user"]._id }))!.search,
    /duy-tam|duy tam/
  );
  const superLogin = await api("POST", "/login", {
    email: "super-admin@example.com",
    password: "Super-admin-test-password-2026!"
  });
  assert.equal(
    (await api("PATCH", "/profile", { fullName: "Changed" }, asSession(superLogin))).status,
    403
  );
  assert.equal(
    (
      await api(
        "POST",
        "/email-change/request",
        { newEmail: "new-super@example.com", password: "Super-admin-test-password-2026!" },
        asSession(superLogin)
      )
    ).status,
    403
  );
});

test("email: verification, ownership, resend, race-safe consume and all-session revocation", async () => {
  const user = await newUser("email-user");
  const second = await login("email-user");
  const other = await newUser("email-other");
  const target = "changed-user@example.com";
  assert.equal(
    (await api("POST", "/email-change/request", { newEmail: target, password: "wrong" }, user))
      .status,
    401
  );
  for (const newEmail of [users.owner.email, "super-admin@example.com"])
    assert.equal(
      (await api("POST", "/email-change/request", { newEmail, password }, user)).status,
      409
    );
  await authDb.collection("rate_limits").deleteMany({});
  assert.equal(
    (await api("POST", "/email-change/request", { newEmail: target, password }, user)).status,
    200
  );
  const stale = tokenFromMail(target, "/change-email");
  assert.equal(
    (await api("GET", "/me", undefined, user)).body.account.email,
    users["email-user"].email
  );
  assert.equal(
    (await api("POST", "/email-change/request", { newEmail: target, password }, user)).status,
    200
  );
  const token = tokenFromMail(target, "/change-email");
  assert.notEqual(token, stale);
  assert.equal(
    (await api("POST", "/email-change/confirm", { token: stale, password }, user)).status,
    400
  );
  assert.equal(
    (await api("POST", "/email-change/confirm", { token, password }, other)).status,
    400
  );
  const results = await Promise.all(
    [1, 2].map(() => api("POST", "/email-change/confirm", { token, password }, user))
  );
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  for (const session of [user, second])
    assert.equal((await api("GET", "/me", undefined, session)).status, 401);
  const signed = await api("POST", "/login", { email: target, password });
  assert.equal(signed.status, 200);
  assert.equal(
    (await api("POST", "/email-change/confirm", { token, password }, asSession(signed))).status,
    400
  );
  assert.equal(
    (await api("POST", "/login", { email: users["email-user"].email, password })).status,
    401
  );
});

test("email: concurrent unique target and expiry leave losing account unchanged", async () => {
  const a = await newUser("email-race-a"),
    b = await newUser("email-race-b");
  const target = "concurrent-target@example.com";
  assert.equal(
    (await api("POST", "/email-change/request", { newEmail: target, password }, a)).status,
    200
  );
  const tokenA = tokenFromMail(target, "/change-email");
  assert.equal(
    (await api("POST", "/email-change/request", { newEmail: target, password }, b)).status,
    200
  );
  const tokenB = tokenFromMail(target, "/change-email");
  const results = await Promise.all([
    api("POST", "/email-change/confirm", { token: tokenA, password }, a),
    api("POST", "/email-change/confirm", { token: tokenB, password }, b)
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(await authDb.collection("accounts-admin").countDocuments({ email: target }), 1);
  const expired = await newUser("email-expired");
  await authDb.collection("rate_limits").deleteMany({});
  await api(
    "POST",
    "/email-change/request",
    { newEmail: "expired-target@example.com", password },
    expired
  );
  const token = tokenFromMail("expired-target@example.com", "/change-email");
  await authDb
    .collection("email_change_tokens")
    .updateOne({ userId: users["email-expired"]._id }, { $set: { expiresAt: new Date(0) } });
  assert.equal(
    (await api("POST", "/email-change/confirm", { token, password }, expired)).status,
    400
  );
});

test("MFA: enrollment ownership/expiry, pending state, encrypted storage and session rotation", async () => {
  const user = await newUser("mfa-enroll");
  const anotherSession = await login("mfa-enroll");
  const setup = await api("POST", "/2fa/setup", { password }, user);
  assert.equal(setup.status, 200);
  assert.match(setup.body.data.otpauthUri, /^otpauth:\/\/totp\//);
  assert.equal((await api("GET", "/2fa/status", undefined, user)).body.data.enabled, false);
  const body = { setupToken: setup.body.data.setupToken, otp: otp(setup.body.data.secret) };
  assert.equal((await api("POST", "/2fa/enable", body, anotherSession)).status, 400);
  const enabled = await api("POST", "/2fa/enable", body, user);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
  assert.equal(enabled.body.data.recoveryCodes.length, 10);
  assert.equal((await api("GET", "/me", undefined, user)).status, 401);
  assert.equal((await api("GET", "/me", undefined, anotherSession)).status, 401);
  const current = asSession(enabled);
  assert.equal(
    (await api("GET", "/2fa/status", undefined, current)).body.data.recoveryCodesRemaining,
    10
  );
  const state = await authDb
    .collection("auth_security")
    .findOne({ userId: users["mfa-enroll"]._id });
  assert.ok(state!.encryptedSecret && !state!.encryptedSecret.includes(setup.body.data.secret));
  for (const code of enabled.body.data.recoveryCodes)
    assert.equal(JSON.stringify(state).includes(code), false);
  const profile = await api("GET", "/me", undefined, current);
  assert.equal(/encryptedSecret|recoveryHashes|tokenId/.test(JSON.stringify(profile.body)), false);
  assert.equal(profile.body.account.mfaEnabled, true);
});

test("MFA: password-only challenge, TOTP replay, remember duration, one-time recovery under concurrency", async () => {
  const original = await newUser("mfa-login");
  const mfa = await enroll(original);
  const firstChallenge = await challenge(users["mfa-login"].email, password, true);
  const verified = await api("POST", "/login/2fa", {
    challengeToken: firstChallenge,
    otp: otp(mfa.secret, 30)
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const claims = jwt.decode(verified.cookie!.slice("tokenAdmin=".length));
  assert.equal(claims.exp - claims.iat, 604800);
  assert.equal(
    (
      await api("POST", "/login/2fa", {
        challengeToken: firstChallenge,
        recoveryCode: mfa.codes[0]
      })
    ).status,
    401
  );
  const secondChallenge = await challenge(users["mfa-login"].email);
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: secondChallenge, otp: otp(mfa.secret, 30) }))
      .status,
    401
  );
  const parallelChallenge = await challenge(users["mfa-login"].email);
  const parallelChallenge2 = await challenge(users["mfa-login"].email);
  const results = await Promise.all(
    [parallelChallenge, parallelChallenge2].map((challengeToken) =>
      api("POST", "/login/2fa", { challengeToken, recoveryCode: mfa.codes[0] })
    )
  );
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.equal(
    (await api("GET", "/2fa/status", undefined, mfa.user)).body.data.recoveryCodesRemaining,
    9
  );
  const stored = await authDb
    .collection("auth_challenges")
    .findOne({ userId: users["mfa-login"]._id, purpose: "login" });
  assert.equal(JSON.stringify(stored).includes(firstChallenge), false);
});

test("MFA: five-attempt cap, expiry, extra claims and stale account/version fail closed", async () => {
  const user = await newUser("mfa-invalid");
  const mfa = await enroll(user);
  const challengeToken = await challenge(users["mfa-invalid"].email);
  for (let index = 0; index < 5; index++)
    assert.equal(
      (await api("POST", "/login/2fa", { challengeToken, recoveryCode: "A".repeat(22) })).status,
      401
    );
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken, recoveryCode: mfa.codes[0] })).status,
    401
  );
  const expired = await challenge(users["mfa-invalid"].email);
  await authDb
    .collection("auth_challenges")
    .updateMany({ userId: users["mfa-invalid"]._id }, { $set: { expiresAt: new Date(0) } });
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: expired, recoveryCode: mfa.codes[0] }))
      .status,
    401
  );
  const stale = await challenge(users["mfa-invalid"].email);
  assert.equal(
    (
      await api("POST", "/login/2fa", {
        challengeToken: stale,
        recoveryCode: mfa.codes[0],
        userId: users.owner._id.toString()
      })
    ).status,
    400
  );
  await authDb
    .collection("accounts-admin")
    .updateOne({ _id: users["mfa-invalid"]._id }, { $inc: { authVersion: 1 } });
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: stale, recoveryCode: mfa.codes[0] })).status,
    401
  );
});

test("MFA: regeneration and disable require reauth, revoke old sessions and pending challenges", async () => {
  const user = await newUser("mfa-manage");
  const mfa = await enroll(user);
  const pending = await challenge(users["mfa-manage"].email);
  assert.equal((await api("POST", "/2fa/disable", { password }, mfa.user)).status, 401);
  assert.equal(
    (await api("POST", "/2fa/disable", { password: "wrong", recoveryCode: mfa.codes[0] }, mfa.user))
      .status,
    401
  );
  const regenerated = await api(
    "POST",
    "/2fa/recovery-codes/regenerate",
    { password, recoveryCode: mfa.codes[0] },
    mfa.user
  );
  assert.equal(regenerated.status, 200, JSON.stringify(regenerated.body));
  assert.equal((await api("GET", "/me", undefined, mfa.user)).status, 401);
  assert.equal(
    (
      await api("POST", "/login/2fa", {
        challengeToken: pending,
        recoveryCode: regenerated.body.data.recoveryCodes[0]
      })
    ).status,
    401
  );
  const newChallenge = await challenge(users["mfa-manage"].email);
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: newChallenge, recoveryCode: mfa.codes[1] }))
      .status,
    401
  );
  const current = asSession(regenerated);
  assert.equal(
    (
      await api(
        "POST",
        "/2fa/disable",
        { password, recoveryCode: regenerated.body.data.recoveryCodes[0] },
        current
      )
    ).status,
    200
  );
  assert.equal((await api("GET", "/me", undefined, current)).status, 401);
  assert.equal(
    (await api("POST", "/login", { email: users["mfa-manage"].email, password })).status,
    200
  );
});

test("MFA: password reset preserves enabled MFA and invalidates existing sessions/challenges", async () => {
  const user = await newUser("mfa-reset");
  const mfa = await enroll(user);
  const pending = await challenge(users["mfa-reset"].email);
  await api("POST", "/password/forgot", { email: users["mfa-reset"].email });
  const token = tokenFromMail(users["mfa-reset"].email, "/reset-password");
  const newPassword = "Reset-password-2026!";
  assert.equal(
    (
      await api("POST", "/password/reset", {
        token,
        password: newPassword,
        confirmPassword: newPassword
      })
    ).status,
    200
  );
  assert.equal((await api("GET", "/me", undefined, mfa.user)).status, 401);
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: pending, recoveryCode: mfa.codes[0] }))
      .status,
    401
  );
  const newChallenge = await challenge(users["mfa-reset"].email, newPassword);
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: newChallenge, recoveryCode: mfa.codes[0] }))
      .status,
    200
  );
});

test("Super Admin: MFA cannot be bypassed through env password, logout-all or alternate route", async () => {
  const email = "super-admin@example.com",
    credential = "Super-admin-test-password-2026!";
  const original = await api("POST", "/login", { email, password: credential });
  const mfa = await enroll(asSession(original), credential);
  superMfaCodes = mfa.codes;
  assert.equal(
    await authDb
      .collection("accounts-admin")
      .countDocuments({ _id: new mongoose.Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa") }),
    0
  );
  const alternate = await request(authUrl, "POST", "/admin/account/login", {
    email,
    password: credential
  });
  assert.equal(alternate.status, 202);
  assert.equal(alternate.cookie, undefined);
  const completed = await api("POST", "/login/2fa", {
    challengeToken: alternate.body.data.challengeToken,
    recoveryCode: mfa.codes[0]
  });
  assert.equal(completed.status, 200);
  assert.equal(
    (
      await api(
        "POST",
        "/logout-all",
        { password: credential, recoveryCode: mfa.codes[1] },
        asSession(completed)
      )
    ).status,
    200
  );
  assert.equal((await api("GET", "/me", undefined, mfa.user)).status, 401);
  assert.equal((await api("GET", "/me", undefined, asSession(completed))).status, 401);
  await challenge(email, credential);
});

test("history: known failures, completed MFA successes, pagination and safe metadata ownership", async () => {
  const user = await newUser("history-user");
  await api("POST", "/login", { email: users["history-user"].email, password: "wrong" });
  await api("POST", "/login", { email: "does-not-exist@example.com", password: "wrong" });
  const signed = await api(
    "POST",
    "/login",
    { email: users["history-user"].email, password },
    undefined,
    { "User-Agent": "device".repeat(150), "X-Forwarded-For": "203.0.113.77" }
  );
  const history = await api("GET", "/login-history", undefined, asSession(signed));
  assert.equal(history.status, 200);
  assert.ok(history.body.data.items.some((item: any) => item.outcome === "denied"));
  assert.ok(history.body.data.items.some((item: any) => item.outcome === "success"));
  assert.ok(
    history.body.data.items.every(
      (item: any) => (item.userAgent || "").length <= 512 && item.ip !== "203.0.113.77"
    )
  );
  assert.equal(
    /tokenHash|encryptedSecret|recoveryCode|does-not-exist/.test(JSON.stringify(history.body)),
    false
  );
  assert.equal(JSON.stringify(history.body).includes(password), false);
  assert.ok(history.body.data.items.every((item: any) => item.password === undefined));
  assert.equal(
    (await api("GET", "/login-history?userId=" + users.owner._id, undefined, user)).status,
    400
  );
  assert.equal((await api("GET", "/login-history?limit=101", undefined, user)).status, 400);
  const one = await api("GET", "/login-history?limit=1&outcome=denied", undefined, user);
  assert.equal(one.body.data.items.length, 1);
  assert.ok(one.body.data.items.every((item: any) => item.outcome === "denied"));
});

test("security boundaries: Origin, cross-session CSRF and rate limits protect new mutations", async () => {
  const user = await newUser("guards-user");
  const otherSession = await login("guards-user");
  assert.equal(
    (
      await api("PATCH", "/profile", { fullName: "Guard User" }, user, {
        Origin: "https://evil.example"
      })
    ).status,
    403
  );
  assert.equal(
    (
      await api(
        "PATCH",
        "/profile",
        { fullName: "Guard User" },
        { cookie: user.cookie, csrfToken: otherSession.csrfToken }
      )
    ).status,
    403
  );
  for (let index = 0; index < 3; index++)
    assert.equal(
      (
        await api(
          "POST",
          "/email-change/request",
          { newEmail: "guard-target@example.com", password },
          user
        )
      ).status,
      200
    );
  assert.equal(
    (
      await api(
        "POST",
        "/email-change/request",
        { newEmail: "guard-target@example.com", password },
        user
      )
    ).status,
    429
  );
});

test("MFA enrollment: expired setup cannot enable, and enrollment OTP replay stays denied", async () => {
  const user = await newUser("setup-expiry");
  const setup = await api("POST", "/2fa/setup", { password }, user);
  assert.equal(setup.status, 200);
  await authDb
    .collection("auth_challenges")
    .updateMany({ userId: users["setup-expiry"]._id }, { $set: { expiresAt: new Date(0) } });
  assert.equal(
    (
      await api(
        "POST",
        "/2fa/enable",
        { setupToken: setup.body.data.setupToken, otp: otp(setup.body.data.secret) },
        user
      )
    ).status,
    400
  );
  assert.equal((await api("GET", "/2fa/status", undefined, user)).body.data.enabled, false);
  const mfa = await enroll(user);
  const pending = await challenge(users["setup-expiry"].email);
  assert.equal(
    (await api("POST", "/login/2fa", { challengeToken: pending, otp: otp(mfa.secret) })).status,
    401
  );
});

test("MFA email change needs factor on both request and confirm; reset does not allow email bypass", async () => {
  const original = await newUser("mfa-email");
  const mfa = await enroll(original);
  const target = "mfa-email-new@example.com";
  assert.equal(
    (await api("POST", "/email-change/request", { newEmail: target, password }, mfa.user)).status,
    401
  );
  assert.equal(
    (
      await api(
        "POST",
        "/email-change/request",
        { newEmail: target, password, recoveryCode: mfa.codes[0] },
        mfa.user
      )
    ).status,
    200
  );
  const token = tokenFromMail(target, "/change-email");
  assert.equal(
    (await api("POST", "/email-change/confirm", { token, password }, mfa.user)).status,
    401
  );
  assert.equal(
    (
      await api(
        "POST",
        "/email-change/confirm",
        { token, password, recoveryCode: mfa.codes[1] },
        mfa.user
      )
    ).status,
    200
  );
  await challenge(target);
});

test("SMTP failure keeps existing email and prevents using the unsent token", async () => {
  const user = await newUser("mail-failure");
  const port = await freePort();
  const smtpPort = await freePort();
  const url = "http://127.0.0.1:" + port;
  await startService("auth-service", url, port, mongo.getUri("auth_test"), smtpPort);
  const result = await request(
    url,
    "POST",
    "/api/v1/auth/email-change/request",
    { newEmail: "unsent@example.com", password },
    user
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.reasonCode, "AUTH_DEPENDENCY_UNAVAILABLE");
  assert.equal(
    (await api("GET", "/me", undefined, user)).body.account.email,
    users["mail-failure"].email
  );
  const action = await authDb
    .collection("email_change_tokens")
    .findOne({ userId: users["mail-failure"]._id });
  assert.ok(action!.consumedAt);
});

test("migration: dry-run is read-only, apply is idempotent and audit expiry is backfilled on temporary DB", async () => {
  const uri = mongo.getUri("migration_test");
  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    const createdAt = new Date(Date.now() - 86400000);
    await connection
      .collection("auth_audit_logs")
      .insertOne({ action: "login", outcome: "denied", createdAt });
    const run = async (mode: string) => {
      const child = spawn(
        process.execPath,
        ["services/auth-service/database/migrations/20261123-auth-account-features.mjs", mode],
        {
          env: { ...process.env, AUTH_MIGRATION_URI: uri },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );
      let diagnostics = "";
      child.stdout.on("data", (chunk) => {
        diagnostics += chunk;
      });
      child.stderr.on("data", (chunk) => {
        diagnostics += chunk;
      });
      const [code] = await once(child, "exit");
      assert.equal(code, 0, diagnostics);
      assert.ok(!diagnostics.includes(uri));
    };
    const collections = await connection.db!.listCollections().toArray();
    await run("--dry-run");
    assert.equal((await connection.db!.listCollections().toArray()).length, collections.length);
    assert.equal(
      (await connection.collection("auth_audit_logs").findOne({}))!.expiresAt,
      undefined
    );
    await run("--apply");
    await run("--apply");
    const audit = await connection.collection("auth_audit_logs").findOne({});
    assert.equal(audit!.expiresAt.getTime(), createdAt.getTime() + 90 * 86400000);
    assert.ok(
      (await connection.collection("auth_sessions").indexes()).some(
        (index) => index.key.tokenIdHash && index.unique
      )
    );
    assert.ok(
      (await connection.collection("auth_sessions").indexes()).some(
        (index) => index.key.expiresAt && index.expireAfterSeconds === 0
      )
    );
  } finally {
    await connection.close();
  }
});

test("security races: password reset cannot leave a session issued with the old password active", async () => {
  const original = await newUser("reset-race");
  await api("POST", "/password/forgot", { email: users["reset-race"].email });
  const token = tokenFromMail(users["reset-race"].email, "/reset-password");
  const newPassword = "Race-new-password-2026!";
  const [signed, reset] = await Promise.all([
    api("POST", "/login", { email: users["reset-race"].email, password }),
    api("POST", "/password/reset", { token, password: newPassword, confirmPassword: newPassword })
  ]);
  assert.equal(reset.status, 200);
  assert.ok([200, 401].includes(signed.status));
  assert.equal((await api("GET", "/me", undefined, original)).status, 401);
  if (signed.status === 200)
    assert.equal((await api("GET", "/me", undefined, asSession(signed))).status, 401);
  assert.equal(
    (await api("POST", "/login", { email: users["reset-race"].email, password: newPassword }))
      .status,
    200
  );
});

test("MFA runtime: wrong encryption key never falls back to password-only login", async () => {
  const original = await newUser("wrong-key");
  const mfa = await enroll(original);
  const port = await freePort();
  const smtpPort = (smtp.address() as { port: number }).port;
  const url = "http://127.0.0.1:" + port;
  await startService("auth-service", url, port, mongo.getUri("auth_test"), smtpPort, {
    AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 21).toString("base64")
  });
  const started = await request(url, "POST", "/api/v1/auth/login", {
    email: users["wrong-key"].email,
    password
  });
  assert.equal(started.status, 202);
  assert.equal(started.cookie, undefined);
  const completed = await request(url, "POST", "/api/v1/auth/login/2fa", {
    challengeToken: started.body.data.challengeToken,
    otp: otp(mfa.secret, 30)
  });
  assert.equal(completed.status, 503);
  assert.equal(completed.body.reasonCode, "MFA_CONFIGURATION_INVALID");
  assert.equal(completed.cookie, undefined);
});

test("Super Admin: changing env password invalidates sessions but retains the same principal's MFA", async () => {
  // The earlier Super Admin test enrolled MFA; that record must survive an env password change.
  const oldChallenge = await challenge(
    "super-admin@example.com",
    "Super-admin-test-password-2026!"
  );
  const previousSession = await api("POST", "/login/2fa", {
    challengeToken: oldChallenge,
    recoveryCode: superMfaCodes[2]
  });
  assert.equal(previousSession.status, 200);
  const staleChallenge = await challenge(
    "super-admin@example.com",
    "Super-admin-test-password-2026!"
  );
  const port = await freePort();
  const smtpPort = (smtp.address() as { port: number }).port;
  const url = "http://127.0.0.1:" + port;
  const credential = "Super-admin-updated-password-2026!";
  await startService("auth-service", url, port, mongo.getUri("auth_test"), smtpPort, {
    SUPER_ADMIN_PASSWORD: credential
  });
  assert.equal(
    (await request(url, "GET", "/api/v1/auth/me", undefined, asSession(previousSession))).status,
    401
  );
  assert.equal(
    (
      await request(url, "POST", "/api/v1/auth/login/2fa", {
        challengeToken: staleChallenge,
        recoveryCode: superMfaCodes[3]
      })
    ).status,
    401
  );
  const old = await request(url, "POST", "/api/v1/auth/login", {
    email: "super-admin@example.com",
    password: "Super-admin-test-password-2026!"
  });
  assert.equal(old.status, 401);
  const started = await request(url, "POST", "/api/v1/auth/login", {
    email: "super-admin@example.com",
    password: credential
  });
  assert.equal(started.status, 202);
  assert.equal(started.cookie, undefined);
  const state = await authDb
    .collection("auth_security")
    .findOne({ userId: new mongoose.Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa") });
  assert.equal(state!.mfaEnabled, true);
  assert.equal(await authDb.collection("accounts-admin").countDocuments({ _id: state!.userId }), 0);
});

test("startup prerequisites: missing MFA key and MongoDB standalone both refuse to start", async () => {
  const smtpPort = (smtp.address() as { port: number }).port;
  const port = await freePort();
  await assert.rejects(
    () =>
      startService(
        "auth-service",
        "http://127.0.0.1:" + port,
        port,
        mongo.getUri("auth_test"),
        smtpPort,
        { AUTH_MFA_ENCRYPTION_KEY: "" }
      ),
    /exited/
  );
  const standalone = await MongoMemoryServer.create({
    binary: { version: "7.0.24" },
    instance: { args: ["--wiredTigerCacheSizeGB", "0.25"] }
  });
  try {
    const standalonePort = await freePort();
    await assert.rejects(
      () =>
        startService(
          "auth-service",
          "http://127.0.0.1:" + standalonePort,
          standalonePort,
          standalone.getUri("auth_standalone_test"),
          smtpPort
        ),
      /exited/
    );
  } finally {
    await standalone.stop();
  }
});
