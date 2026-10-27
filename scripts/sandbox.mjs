import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ensureEnv, readEnv, validateEnv, sandboxId } from "./sandbox-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, "infrastructure/sandbox/.env");
export function composeArgs() {
  return [
    "compose",
    "--project-name",
    sandboxId,
    "--env-file",
    envFile,
    "-f",
    path.join(root, "infrastructure/sandbox/compose.yaml")
  ];
}
export function compose(args, env, capture = false) {
  const result = spawnSync("docker", [...composeArgs(), ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8"
  });
  if (result.error?.code === "ENOENT")
    throw new Error(
      "Docker is not installed or is not in PATH. Install/start Docker Desktop with Linux containers, then rerun this command."
    );
  if (result.error || result.status !== 0)
    throw new Error("Docker command failed; inspect the sandbox status/logs.");
  return result.stdout?.trim();
}
async function main() {
  const command = process.argv[2] || "status";
  if (command === "init") {
    ensureEnv(envFile);
    console.log(
      "Sandbox .env ready; existing secrets preserved. No service .env files were changed."
    );
    return;
  }
  if (!fs.existsSync(envFile)) throw new Error("Run npm run sandbox:init first");
  const env = validateEnv(readEnv(envFile));
  if (command === "smoke") {
    const { smoke } = await import("./sandbox-smoke.mjs");
    await smoke(env);
    return;
  }
  if (command === "check") return compose(["config", "--quiet"], env);
  if (command === "up") {
    compose(["config", "--quiet"], env);
    compose(["up", "--build", "-d"], env);
    const urls = [env.AUTH_PORT, env.TENANT_PORT, env.DOCUMENT_PORT].map(
      (port) => "http://127.0.0.1:" + port + "/health/ready"
    );
    const deadline = Date.now() + 300000;
    const pending = new Set(urls);
    while (pending.size && Date.now() < deadline) {
      await Promise.all(
        [...pending].map(async (url) => {
          try {
            if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok) pending.delete(url);
          } catch {}
        })
      );
      if (pending.size) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (pending.size)
      throw new Error(
        "Sandbox did not become ready. Run npm run sandbox:status and npm run sandbox:logs."
      );
    console.log(
      "Auth, Tenant and Document ready; dedicated sandbox databases and private S3 bucket initialized."
    );
    return;
  }
  if (command === "down") return compose(["down"], env); // Keep sandbox volumes.
  if (command === "status") return compose(["ps", "-a"], env);
  if (command === "logs") return compose(["logs", "--tail", "100"], env);
  throw new Error("Unknown sandbox command");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
