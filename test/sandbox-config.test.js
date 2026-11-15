const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("yaml");
const root = path.resolve(__dirname, "..");
const config = parse(
  fs.readFileSync(path.join(root, "infrastructure/sandbox/compose.yaml"), "utf8"),
  { merge: true }
);

test("sandbox keeps databases private and publishes application ports only to loopback", () => {
  assert.equal(config.name, "saas-auth-tenant-document-test");
  assert.equal(config.networks.sandbox.internal, true);
  assert.equal(config.networks.access.internal, undefined);
  for (const [name, service] of Object.entries(config.services)) {
    const expectedNetworks = ["auth", "tenant", "document", "s3"].includes(name)
      ? ["sandbox", "access"]
      : ["sandbox"];
    assert.deepEqual(service.networks, expectedNetworks, name);
    assert.equal(service.container_name, undefined);
    for (const port of service.ports || []) assert.ok(port.startsWith("127.0.0.1:"), name);
  }
  for (const name of ["mongo", "redis"]) assert.equal(config.services[name].ports, undefined);
  for (const volume of Object.values(config.volumes)) assert.ok(!volume?.external && !volume?.name);
});

test("sandbox injects the same credentials on both ends of each service contract", () => {
  const { auth, tenant, document } = config.services;
  const variable = (value) => value.match(/^\$\{([A-Z0-9_]+)/)[1];
  assert.equal(
    variable(auth.environment.AUTH_TENANT_TOKEN),
    variable(tenant.environment.AUTH_TENANT_TOKEN)
  );
  assert.equal(
    variable(tenant.environment.DOCUMENT_SERVICE_TOKEN),
    variable(document.environment.DOCUMENT_SERVICE_TOKEN)
  );
  assert.equal(tenant.environment.AUTH_SERVICE_URL, "http://auth:8080");
  assert.equal(
    document.environment.DOCUMENT_UPLOAD_AUTH_URL,
    "http://tenant:8080/internal/authorization/course"
  );
  assert.equal(tenant.environment.JWT_SECRET, undefined);
  assert.equal(document.environment.JWT_SECRET, undefined);
  assert.equal(auth.environment.NODE_ENV, "test");
  assert.equal(tenant.environment.NODE_ENV, "test");
});

test("sandbox waits for replica set, private bucket and real dependency readiness", () => {
  assert.equal(
    config.services.auth.depends_on["mongo-init"].condition,
    "service_completed_successfully"
  );
  assert.equal(
    config.services.document.depends_on["s3-init"].condition,
    "service_completed_successfully"
  );
  for (const dependency of ["redis", "tenant"]) {
    assert.equal(config.services.document.depends_on[dependency].condition, "service_healthy");
  }
  assert.equal(config.services.postgres, undefined);
  assert.ok(
    Object.hasOwn(config.volumes, "postgres-data"),
    "Historical SQL volume declaration must be retained"
  );
  assert.ok(
    fs
      .readFileSync(path.join(root, "infrastructure/sandbox/s3-init.sh"), "utf8")
      .includes("mc anonymous set none")
  );
  assert.match(config.services.mongo.command[0], /--replSet sandbox-rs/);
  assert.ok(config.services["mongo-init"].entrypoint.includes("--nodb"));
  for (const service of ["auth", "tenant", "document"]) {
    assert.ok(config.services[service].healthcheck.test.join(" ").includes("/health/ready"));
  }
});

test("sandbox environment generation preserves existing secrets and rejects unsafe configuration", async () => {
  const { createEnv, ensureEnv, validateEnv } = await import("../scripts/sandbox-env.mjs");
  const directory = path.join(root, ".test-data");
  fs.mkdirSync(directory, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(directory, "sandbox-env-"));
  try {
    const file = path.join(temporary, ".env");
    const { ensureRuntimeCredentials, validateRuntimeCredentials } =
      await import("../infrastructure/sandbox/runtime-credentials.mjs");
    const first = ensureRuntimeCredentials(file, ensureEnv(file));
    const second = ensureRuntimeCredentials(file, ensureEnv(file));
    assert.throws(() =>
      validateRuntimeCredentials({ ...first, AUTH_MONGO_USERNAME: first.MONGO_USERNAME })
    );
    assert.throws(() =>
      validateRuntimeCredentials({ ...first, TENANT_MONGO_PASSWORD: first.AUTH_MONGO_PASSWORD })
    );
    assert.deepEqual(first, second);
    assert.notEqual(first.AUTH_TENANT_TOKEN, first.DOCUMENT_SERVICE_TOKEN);
    assert.notEqual(first.JWT_SECRET, first.AUTH_TENANT_TOKEN);
    assert.notEqual(first.MONGO_PASSWORD, createEnv().MONGO_PASSWORD);
    assert.throws(() => validateEnv({ ...first, SANDBOX_ID: "production" }));
    assert.throws(() => validateEnv({ ...first, MONGO_PASSWORD: "unsafe/password" }));
    assert.throws(() => validateEnv({ ...first, AUTH_PORT: first.DOCUMENT_PORT }));
    const names = fs
      .readFileSync(path.join(root, "infrastructure/sandbox/.env.example"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        assert.match(line, /^[A-Z0-9_]+=$/);
        return line.slice(0, -1);
      });
    assert.deepEqual(names.sort(), Object.keys(first).sort());
  } finally {
    assert.ok(path.resolve(temporary).startsWith(directory + path.sep));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("runtime app URIs cannot use bootstrap Mongo root", () => {
  for (const [service, domain, db] of [
    ["auth", "AUTH", "auth_sandbox"],
    ["tenant", "TENANT", "tenant_sandbox"],
    ["document", "DOCUMENT", "document_sandbox"]
  ]) {
    const env = config.services[service].environment;
    const uri = env.MONGODB_URI || env.DOCUMENT_MONGODB_URI;
    assert.ok(uri.includes("\${" + domain + "_MONGO_USERNAME}"));
    assert.ok(uri.includes("authSource=" + db));
    assert.ok(!uri.includes("\${MONGO_USERNAME}"));
    assert.equal(env.MONGO_PASSWORD, undefined);
  }
});

test("the runtime PDF is exactly the fixture parsed by PDFBox", async () => {
  const { uploadPdf } = await import("../infrastructure/sandbox/pdf-fixture.mjs");
  assert.deepEqual(
    uploadPdf(),
    fs.readFileSync(path.join(root, "services/document-service/src/test/resources/upload-r1.pdf"))
  );
});

test("Mongo bootstrap is idempotent and refuses existing broad roles or changed passwords", () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(root, "infrastructure/sandbox/mongo-init.js"), "utf8");
  const env = {
    MONGO_USERNAME: "root-bootstrap",
    MONGO_PASSWORD: "root-password",
    AUTH_MONGO_USERNAME: "auth_app",
    AUTH_MONGO_PASSWORD: "auth-password",
    TENANT_MONGO_USERNAME: "tenant_app",
    TENANT_MONGO_PASSWORD: "tenant-password",
    DOCUMENT_MONGO_USERNAME: "document_app",
    DOCUMENT_MONGO_PASSWORD: "document-password"
  };
  const users = new Map();
  let creates = 0,
    updates = 0;
  class Mongo {
    getDB(name) {
      const connection = this;
      return {
        auth(user, password) {
          if (name === "admin" && user === env.MONGO_USERNAME && password === env.MONGO_PASSWORD) {
            connection.isRoot = true;
            return { ok: 1 };
          }
          const saved = users.get(name + ":" + user);
          if (!saved || saved.pwd !== password) throw new Error("Authentication failed");
          connection.own = name;
          return { ok: 1 };
        },
        runCommand() {
          assert.ok(connection.isRoot);
          return { ok: 1, isWritablePrimary: true };
        },
        getUser(user) {
          assert.ok(connection.isRoot);
          return users.get(name + ":" + user) || null;
        },
        createUser(user) {
          assert.ok(connection.isRoot);
          assert.ok(!users.has(name + ":" + user.user));
          users.set(name + ":" + user.user, structuredClone(user));
          creates++;
        },
        updateUser(user, fields) {
          updates++;
          Object.assign(users.get(name + ":" + user), fields);
        },
        getCollection() {
          return {
            findOne() {
              assert.ok(connection.isRoot || connection.own === name);
              return null;
            }
          };
        }
      };
    }
  }
  const run = (values = env) =>
    vm.runInNewContext(
      source,
      { Mongo, process: { env: values }, print() {}, sleep() {} },
      { timeout: 1000 }
    );
  run();
  run();
  assert.equal(creates, 3);
  assert.equal(updates, 0);
  for (const [db, user] of [
    ["auth_sandbox", "auth_app"],
    ["tenant_sandbox", "tenant_app"],
    ["document_sandbox", "document_app"]
  ]) {
    assert.deepEqual(users.get(db + ":" + user).roles, [{ role: "readWrite", db }]);
  }
  assert.throws(() => run({ ...env, AUTH_MONGO_PASSWORD: "new-password-not-approved" }));
  assert.equal(users.get("auth_sandbox:auth_app").pwd, "auth-password");
  assert.equal(updates, 0);
  users.get("auth_sandbox:auth_app").roles = [{ role: "root", db: "admin" }];
  assert.throws(() => run());
  assert.equal(updates, 0);
});
