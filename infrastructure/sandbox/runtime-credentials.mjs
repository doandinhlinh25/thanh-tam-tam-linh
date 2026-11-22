import fs from "node:fs";
import { randomBytes } from "node:crypto";

/** Append missing sandbox app credentials without replacing any existing secret. */
export function ensureRuntimeCredentials(file, env) {
  const additions = {};
  for (const domain of ["AUTH", "TENANT", "DOCUMENT"]) {
    for (const [key, value] of [
      [domain + "_MONGO_USERNAME", domain.toLowerCase() + "_app"],
      [domain + "_MONGO_PASSWORD", randomBytes(32).toString("hex")]
    ])
      if (!env[key]) additions[key] = value;
  }
  const combined = validateRuntimeCredentials({ ...env, ...additions });
  if (Object.keys(additions).length)
    fs.appendFileSync(
      file,
      "\n" +
        Object.entries(additions)
          .map(([key, value]) => key + "=" + value)
          .join("\n") +
        "\n",
      { mode: 0o600 }
    );
  return combined;
}

/** Fail closed if app credentials are absent, reused or point to root. */
export function validateRuntimeCredentials(env) {
  const usernames = [],
    passwords = [];
  for (const domain of ["AUTH", "TENANT", "DOCUMENT"]) {
    const username = env[domain + "_MONGO_USERNAME"],
      password = env[domain + "_MONGO_PASSWORD"];
    if (
      !/^[A-Za-z0-9_-]{3,40}$/.test(username || "") ||
      username === env.MONGO_USERNAME ||
      !/^[A-Za-z0-9_-]{32,}$/.test(password || "") ||
      password === env.MONGO_PASSWORD
    )
      throw new Error("Invalid per-service MongoDB credentials: " + domain);
    usernames.push(username);
    passwords.push(password);
  }
  if (new Set(usernames).size !== 3 || new Set(passwords).size !== 3)
    throw new Error("MongoDB app accounts must be distinct");
  return env;
}
