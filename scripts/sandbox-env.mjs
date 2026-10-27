import fs from "node:fs";
import { randomBytes } from "node:crypto";

export const sandboxId = "saas-auth-tenant-document-test";
const secret = () => randomBytes(32).toString("hex");
export function createEnv() {
  return {
    SANDBOX_ID: sandboxId,
    AUTH_PORT: "14001",
    TENANT_PORT: "14002",
    DOCUMENT_PORT: "18080",
    S3_PORT: "19000",
    S3_CONSOLE_PORT: "19001",
    MONGO_USERNAME: "sandbox",
    MONGO_PASSWORD: secret(),
    MONGO_REPLICA_KEY: secret(),
    POSTGRES_PASSWORD: secret(),
    REDIS_PASSWORD: secret(),
    S3_ACCESS_KEY: "sandbox" + randomBytes(6).toString("hex"),
    S3_SECRET_KEY: secret(),
    JWT_SECRET: secret(),
    AUTH_TENANT_TOKEN: secret(),
    DOCUMENT_SERVICE_TOKEN: secret(),
    CHAT_SERVICE_TOKEN: secret(),
    SUPER_ADMIN_ID: randomBytes(12).toString("hex"),
    SUPER_ADMIN_EMAIL: "superadmin@sandbox.example.com",
    SUPER_ADMIN_PASSWORD: secret()
  };
}
export function readEnv(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        if (i < 1) throw new Error("Invalid sandbox env");
        return [line.slice(0, i), line.slice(i + 1)];
      })
  );
}
export function validateEnv(env) {
  if (env.SANDBOX_ID !== sandboxId)
    throw new Error("This is not the isolated sandbox configuration");
  const ports = ["AUTH_PORT", "TENANT_PORT", "DOCUMENT_PORT", "S3_PORT", "S3_CONSOLE_PORT"].map(
    (key) => env[key]
  );
  if (
    ports.some((port) => !/^\d+$/.test(port || "") || +port < 1024 || +port > 65535) ||
    new Set(ports).size !== ports.length
  )
    throw new Error("Sandbox ports must be distinct TCP ports >= 1024");
  for (const key of [
    "MONGO_PASSWORD",
    "MONGO_REPLICA_KEY",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "S3_SECRET_KEY",
    "JWT_SECRET",
    "AUTH_TENANT_TOKEN",
    "DOCUMENT_SERVICE_TOKEN",
    "CHAT_SERVICE_TOKEN",
    "SUPER_ADMIN_PASSWORD"
  ]) {
    if (!/^[A-Za-z0-9_-]{32,}$/.test(env[key] || ""))
      throw new Error("Invalid sandbox secret: " + key);
  }
  if (
    !/^[A-Za-z0-9_-]{3,20}$/.test(env.S3_ACCESS_KEY || "") ||
    !/^[A-Za-z0-9_-]+$/.test(env.MONGO_USERNAME || "") ||
    !/^[a-f0-9]{24}$/.test(env.SUPER_ADMIN_ID || "") ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPER_ADMIN_EMAIL || "")
  ) {
    throw new Error("Invalid sandbox account configuration");
  }
  return env;
}
export function ensureEnv(file) {
  try {
    const env = createEnv();
    fs.writeFileSync(
      file,
      Object.entries(env)
        .map(([key, value]) => key + "=" + value)
        .join("\n") + "\n",
      { flag: "wx", mode: 0o600 }
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return validateEnv(readEnv(file));
}
