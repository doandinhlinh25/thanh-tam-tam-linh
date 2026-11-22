import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, spawn } from "node:child_process";
import net from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createEnv } from "../../scripts/sandbox-env.mjs";
import { ensureRuntimeCredentials } from "./runtime-credentials.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const parent = path.join(root, ".test-data");
fs.mkdirSync(parent, { recursive: true });
const directory = fs.mkdtempSync(path.join(parent, "r1-mongo-"));
const data = path.join(directory, "mongo");
fs.mkdirSync(data);
process.env.TEMP = directory;
process.env.TMP = directory;
let replica, admin;
const applications = [];
const result = {
  ownDatabaseChecks: 0,
  crossReadDenials: 0,
  crossWriteDenials: 0,
  mavenExitCode: null
};
try {
  const base = createEnv();
  const file = path.join(directory, ".env");
  fs.writeFileSync(
    file,
    Object.entries(base)
      .map(([k, v]) => k + "=" + v)
      .join("\n") + "\n",
    { mode: 0o600 }
  );
  const env = ensureRuntimeCredentials(file, base);
  replica = await MongoMemoryReplSet.create({
    binary: {
      version: "7.0.24",
      ...(process.env.MONGOMS_SYSTEM_BINARY
        ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY }
        : {})
    },
    instanceOpts: [{ dbPath: data, args: ["--wiredTigerCacheSizeGB", "0.25"] }],
    replSet: {
      count: 1,
      name: "sandbox-rs",
      ip: "127.0.0.1",
      storageEngine: "wiredTiger",
      auth: {
        enable: true,
        customRootName: env.MONGO_USERNAME,
        customRootPwd: env.MONGO_PASSWORD,
        keyfileContent: env.MONGO_REPLICA_KEY
      }
    }
  });
  const { MongoClient } = mongoose.mongo;
  admin = await MongoClient.connect(replica.getUri("admin"), {
    auth: { username: env.MONGO_USERNAME, password: env.MONGO_PASSWORD },
    authSource: "admin"
  });
  const specs = [
    ["AUTH", "auth_sandbox"],
    ["TENANT", "tenant_sandbox"],
    ["DOCUMENT", "document_sandbox"]
  ];
  for (const [domain, db] of specs)
    await admin.db(db).command({
      createUser: env[domain + "_MONGO_USERNAME"],
      pwd: env[domain + "_MONGO_PASSWORD"],
      roles: [{ role: "readWrite", db }]
    });
  for (const [domain, own] of specs) {
    const client = await MongoClient.connect(replica.getUri(own), {
      auth: {
        username: env[domain + "_MONGO_USERNAME"],
        password: env[domain + "_MONGO_PASSWORD"]
      },
      authSource: own
    });
    try {
      await client.db(own).collection("r1_acl_probe").insertOne({ probe: true });
      assert.equal(await client.db(own).collection("r1_acl_probe").countDocuments({}), 1);
      result.ownDatabaseChecks++;
      for (const [, other] of specs.filter(([, name]) => name !== own)) {
        await assert.rejects(
          client.db(other).collection("r1_acl_probe").findOne({}),
          (error) => error.code === 13
        );
        result.crossReadDenials++;
        await assert.rejects(
          client.db(other).collection("r1_acl_probe").insertOne({ probe: true }),
          (error) => error.code === 13
        );
        result.crossWriteDenials++;
      }
    } finally {
      await client.close();
    }
  }

  const allocatePort = () =>
    new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  const authPort = await allocatePort(),
    tenantPort = await allocatePort();
  const appUri = (domain, db) => {
    const uri = new URL(replica.getUri(db));
    uri.username = env[domain + "_MONGO_USERNAME"];
    uri.password = env[domain + "_MONGO_PASSWORD"];
    uri.searchParams.set("authSource", db);
    return uri.toString();
  };
  for (const [service, domain, db, port] of [
    ["auth-service", "AUTH", "auth_sandbox", authPort],
    ["tenant-service", "TENANT", "tenant_sandbox", tenantPort]
  ]) {
    const inherited = { ...process.env };
    for (const key of Object.keys(inherited))
      if (/^(MONGO_|AUTH_MONGO_|TENANT_MONGO_|DOCUMENT_MONGO_|JWT_SECRET|SUPER_ADMIN_)/.test(key))
        delete inherited[key];
    const log = fs.openSync(path.join(directory, service + ".log"), "a");
    const child = spawn(process.execPath, ["dist/index.js"], {
      cwd: path.join(root, "services", service),
      windowsHide: true,
      stdio: ["ignore", log, log],
      env: {
        ...inherited,
        NODE_ENV: "test",
        PORT: String(port),
        MONGODB_URI: appUri(domain, db),
        AUTH_SERVICE_URL: "http://127.0.0.1:" + authPort,
        ALLOWED_ORIGINS: "http://localhost:3000",
        APP_URL: "http://localhost:3000",
        AUTH_TENANT_TOKEN: env.AUTH_TENANT_TOKEN,
        ...(domain === "AUTH"
          ? {
              JWT_SECRET: env.JWT_SECRET,
              SUPER_ADMIN_ID: env.SUPER_ADMIN_ID,
              SUPER_ADMIN_EMAIL: env.SUPER_ADMIN_EMAIL,
              SUPER_ADMIN_PASSWORD: env.SUPER_ADMIN_PASSWORD
            }
          : {
              DOCUMENT_SERVICE_TOKEN: env.DOCUMENT_SERVICE_TOKEN,
              CHAT_SERVICE_TOKEN: env.CHAT_SERVICE_TOKEN
            })
      }
    });
    applications.push(child);
    fs.closeSync(log);
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if (
          (
            await fetch("http://127.0.0.1:" + port + "/health/ready", {
              signal: AbortSignal.timeout(2000)
            })
          ).ok
        ) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Scoped-credential application did not become ready");
  }
  async function request(port, route, body, user) {
    const response = await fetch("http://127.0.0.1:" + port + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        ...(user ? { Cookie: user.cookie, "X-CSRF-Token": user.csrf } : {})
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    assert.equal(response.status, 200, "Scoped-credential API regression");
    return {
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0]
    };
  }
  const superLogin = await request(authPort, "/admin/account/login", {
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD
  });
  const adminSession = { cookie: superLogin.cookie, csrf: superLogin.data.csrfToken };
  const account = await request(
    authPort,
    "/admin/account-admin/create",
    {
      fullName: "R1 scoped account",
      email: "r1-scoped@example.com",
      password: env.JWT_SECRET,
      confirmPassword: env.JWT_SECRET,
      status: "active"
    },
    adminSession
  );
  await request(authPort, "/admin/account/login", {
    email: "r1-scoped@example.com",
    password: env.JWT_SECRET
  });
  const tenant = await request(
    tenantPort,
    "/admin/tenant/create",
    { name: "R1 isolated tenant", code: "r1-isolated", ownerId: account.data.account._id },
    adminSession
  );
  assert.ok(tenant.data.tenant._id);
  result.authLoginWithScopedCredential = 200;
  result.tenantTransactionWithScopedCredential = 200;

  const uri = new URL(replica.getUri("document_sandbox"));
  uri.username = env.DOCUMENT_MONGO_USERNAME;
  uri.password = env.DOCUMENT_MONGO_PASSWORD;
  uri.searchParams.set("authSource", "document_sandbox");
  const args = [
    "-B",
    "-ntp",
    ...(process.env.R1_MAVEN_CACHE ? ["-Dmaven.repo.local=" + process.env.R1_MAVEN_CACHE] : []),
    "-f",
    "services/document-service/pom.xml",
    "test"
  ];
  if (process.env.R1_MAVEN_CACHE && !/^[A-Za-z0-9_:/\\.-]+$/.test(process.env.R1_MAVEN_CACHE))
    throw new Error("Unsupported Maven cache path");
  const run = spawnSync(process.platform === "win32" ? "mvn.cmd" : "mvn", args, {
    cwd: root,
    shell: process.platform === "win32",
    windowsHide: true,
    env: { ...process.env, DOCUMENT_TEST_MONGODB_URI: uri.toString() },
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024
  });
  let log = (run.stdout || "") + "\n" + (run.stderr || "");
  for (const value of Object.values(env).filter((v) => v.length >= 16))
    log = log.replaceAll(value, "[redacted]");
  fs.writeFileSync(path.join(directory, "maven.log"), log);
  result.mavenExitCode = run.status;
  fs.writeFileSync(path.join(directory, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(
    log
      .split(/\r?\n/)
      .filter((line) => /Tests run:|BUILD SUCCESS|BUILD FAILURE|\[ERROR\]/.test(line))
      .join("\n")
  );
  console.log(JSON.stringify({ ...result, evidenceDirectory: directory }));
  if (run.error || run.status !== 0) process.exitCode = 1;
} catch (error) {
  console.error("Isolated Mongo verification failed: " + error.name);
  process.exitCode = 1;
} finally {
  for (const child of applications) if (child.exitCode === null) child.kill();
  if (applications.length) await new Promise((resolve) => setTimeout(resolve, 300));
  if (admin) await admin.close();
  if (replica) await replica.stop({ doCleanup: false });
}
