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

test("sandbox uses a private project network and never publishes database ports", () => {
  assert.equal(config.name, "saas-auth-tenant-document-test");
  assert.equal(config.networks.sandbox.internal, true);
  for (const [name, service] of Object.entries(config.services)) {
    assert.deepEqual(service.networks, ["sandbox"], name);
    assert.equal(service.container_name, undefined);
    for (const port of service.ports || []) assert.ok(port.startsWith("127.0.0.1:"), name);
  }
  for (const name of ["mongo", "postgres", "redis"])
    assert.equal(config.services[name].ports, undefined);
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
  for (const dependency of ["postgres", "redis", "tenant"]) {
    assert.equal(config.services.document.depends_on[dependency].condition, "service_healthy");
  }
  assert.ok(
    config.services.postgres.volumes.some((value) => value.includes("001_document_upload.sql"))
  );
  assert.ok(
    fs
      .readFileSync(path.join(root, "infrastructure/sandbox/s3-init.sh"), "utf8")
      .includes("mc anonymous set none")
  );
  assert.match(config.services.mongo.command[0], /--replSet sandbox-rs/);
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
    const first = ensureEnv(file);
    const second = ensureEnv(file);
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
