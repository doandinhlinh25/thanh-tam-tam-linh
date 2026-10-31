import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn, ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve, join, sep } from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import argon2 from "argon2";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/**
 * Harness dùng chung cho test import ghi danh và load test (BT3 VT-004).
 * Chạy Auth + Tenant service thật trên MongoDB replica set in-memory; dữ liệu tenant,
 * membership và course được seed trực tiếp để mỗi test có tenant riêng (không chia sẻ state).
 */
const jwtSecret = "test-jwt-signing-secret-with-at-least-32-characters";
const serviceKey = "test-auth-tenant-credential-32-characters";
export const origin = "http://localhost:3000";
export const password = "Demo-password-2026!";
const testDataRoot = resolve(".test-data");

export type Session = { cookie?: string; csrfToken?: string };
export type ApiResult = { status: number; body: any; elapsedMs: number };

export type Harness = {
  tenantUrl: string;
  tenantDb: mongoose.Connection;
  authDb: mongoose.Connection;
  output: string[];
  /** Tạo account có thể đăng nhập (owner/lecturer/student) và trả về `_id`. */
  createAccount: (label: string) => Promise<mongoose.Types.ObjectId>;
  login: (userId: mongoose.Types.ObjectId) => Promise<Session>;
  request: (method: string, path: string, body?: unknown, session?: Session) => Promise<ApiResult>;
  /** Gửi body thô (dùng cho test giới hạn kích thước). */
  requestRaw: (method: string, path: string, raw: string, session?: Session) => Promise<ApiResult>;
  seedTenant: (input: { ownerId: mongoose.Types.ObjectId; courses?: number }) => Promise<{
    tenantId: mongoose.Types.ObjectId;
    courseIds: mongoose.Types.ObjectId[];
  }>;
  addMembers: (
    tenantId: mongoose.Types.ObjectId,
    userIds: mongoose.Types.ObjectId[],
    role: "tenant_owner" | "tenant_admin" | "lecturer" | "student",
    status?: "active" | "revoked"
  ) => Promise<void>;
  stop: () => Promise<void>;
};

const freePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
};

/**
 * Khởi động MongoDB, Auth và Tenant. `enableTestCommands` bật để test failure-path
 * có thể dùng fail point `failCommand` của MongoDB.
 */
export const startHarness = async (): Promise<Harness> => {
  const processes: ChildProcess[] = [];
  const output: string[] = [];
  const emails = new Map<string, string>();
  await mkdir(testDataRoot, { recursive: true });
  const mongoDataPath = await mkdtemp(join(testDataRoot, "bt3-"));
  const mongo = await MongoMemoryReplSet.create({
    instanceOpts: [
      {
        dbPath: mongoDataPath,
        args: ["--wiredTigerCacheSizeGB", "0.25", "--setParameter", "enableTestCommands=1"]
      }
    ],
    binary: { version: "7.0.24" },
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  const authDb = await mongoose.createConnection(mongo.getUri("auth_test")).asPromise();
  const tenantDb = await mongoose.createConnection(mongo.getUri("tenant_test")).asPromise();
  const authPort = await freePort();
  const tenantPort = await freePort();
  const authUrl = "http://127.0.0.1:" + authPort;
  const tenantUrl = "http://127.0.0.1:" + tenantPort;
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const startService = async (service: string, url: string, port: number, uri: string) => {
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
        DOCUMENT_SERVICE_TOKEN: "test-document-credential-32-characters",
        CHAT_SERVICE_TOKEN: "test-chat-credential-32-characters",
        ...(service === "auth-service"
          ? {
              SUPER_ADMIN_ID: "aaaaaaaaaaaaaaaaaaaaaaaa",
              SUPER_ADMIN_EMAIL: "super-admin@example.com",
              SUPER_ADMIN_PASSWORD: "Super-admin-test-password-2026!"
            }
          : {}),
        APP_URL: origin,
        SMTP_URL: "smtp://127.0.0.1:9",
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

  await startService("auth-service", authUrl, authPort, mongo.getUri("auth_test"));
  await startService("tenant-service", tenantUrl, tenantPort, mongo.getUri("tenant_test"));

  const send = async (
    base: string,
    method: string,
    path: string,
    raw: string | undefined,
    session?: Session
  ): Promise<ApiResult & { setCookie?: string | null }> => {
    const headers: Record<string, string> = { Origin: origin };
    if (raw !== undefined) headers["Content-Type"] = "application/json";
    if (session?.cookie) headers.Cookie = session.cookie;
    if (session?.csrfToken) headers["X-CSRF-Token"] = session.csrfToken;
    const startedAt = performance.now();
    const response = await fetch(base + path, { method, headers, body: raw });
    const body = await response.json();
    return {
      status: response.status,
      body,
      elapsedMs: performance.now() - startedAt,
      setCookie: response.headers.get("set-cookie")
    };
  };

  const harness: Harness = {
    tenantUrl,
    tenantDb,
    authDb,
    output,
    createAccount: async (label) => {
      const _id = new mongoose.Types.ObjectId();
      const email = label + "-" + randomUUID().slice(0, 8) + "@example.com";
      emails.set(String(_id), email);
      await authDb.collection("accounts-admin").insertOne({
        _id,
        email,
        fullName: label,
        password: passwordHash,
        platformRole: "user",
        status: "active",
        emailVerifiedAt: new Date(),
        deleted: false,
        authVersion: 0
      });
      return _id;
    },
    login: async (userId) => {
      await authDb.collection("rate_limits").deleteMany({});
      const result = await send(
        authUrl,
        "POST",
        "/admin/account/login",
        JSON.stringify({ email: emails.get(String(userId)), password })
      );
      if (result.status !== 200) throw new Error("login failed: " + JSON.stringify(result.body));
      return { cookie: result.setCookie?.split(";")[0], csrfToken: result.body.csrfToken };
    },
    request: (method, path, body, session) =>
      send(tenantUrl, method, path, body === undefined ? undefined : JSON.stringify(body), session),
    requestRaw: (method, path, raw, session) => send(tenantUrl, method, path, raw, session),
    seedTenant: async ({ ownerId, courses = 1 }) => {
      const tenantId = new mongoose.Types.ObjectId();
      const code = "bt3-" + randomUUID().slice(0, 8);
      const now = new Date();
      await tenantDb.collection("tenants").insertOne({
        _id: tenantId,
        revision: 0,
        name: code,
        code,
        domain: null,
        description: "",
        logo: null,
        status: "active",
        plan: "free",
        quota: { maxUsers: 5000, maxStorageMB: 500, maxCourses: 1000, maxDailyChats: 100 },
        createdBy: null,
        search: code,
        deleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      });
      await harness.addMembers(tenantId, [ownerId], "tenant_owner");
      const courseIds = Array.from({ length: courses }, () => new mongoose.Types.ObjectId());
      if (courseIds.length)
        await tenantDb.collection("courses").insertMany(
          courseIds.map((_id, index) => ({
            _id,
            tenantId,
            code: "C" + index,
            name: "Course " + index,
            description: "",
            status: "active",
            createdBy: ownerId,
            search: "course " + index,
            deleted: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now
          }))
        );
      return { tenantId, courseIds };
    },
    addMembers: async (tenantId, userIds, role, status = "active") => {
      if (!userIds.length) return;
      const now = new Date();
      await tenantDb.collection("tenant_memberships").insertMany(
        userIds.map((userId) => ({
          tenantId,
          userId,
          role,
          status,
          joinedAt: now,
          deleted: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now
        }))
      );
    },
    stop: async () => {
      await Promise.all(
        processes.map(async (child) => {
          if (child.exitCode !== null) return;
          const exited = once(child, "exit");
          child.kill();
          await exited;
        })
      );
      await authDb.close();
      await tenantDb.close();
      await mongo.stop();
      if (!resolve(mongoDataPath).startsWith(testDataRoot + sep))
        throw new Error("Unsafe test cleanup path");
      await rm(mongoDataPath, { recursive: true, force: true });
    }
  };
  return harness;
};
