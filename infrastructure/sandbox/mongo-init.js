// This script runs only inside the sandbox Docker network.
let ready = false;
for (let attempt = 0; attempt < 90 && !ready; attempt++) {
  try {
    const connection = new Mongo("mongodb://mongo:27017/?directConnection=true");
    const admin = connection.getDB("admin");
    admin.auth(process.env.MONGO_USERNAME, process.env.MONGO_PASSWORD);
    let status;
    try {
      status = admin.runCommand({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.code !== 94) throw error;
      status = { code: 94 };
    }
    if (status.code === 94) {
      const result = admin.runCommand({
        replSetInitiate: {
          _id: "sandbox-rs",
          members: [{ _id: 0, host: "mongo:27017" }]
        }
      });
      if (!result.ok) throw new Error("Replica set initialization failed");
    } else if (!status.ok) {
      throw new Error("Replica set not ready");
    }
    ready = admin.runCommand({ hello: 1 }).isWritablePrimary === true;
  } catch {
    // MongoDB can restart once while its initial root account is created.
  }
  if (!ready) sleep(1000);
}
if (!ready) throw new Error("Sandbox MongoDB primary did not become ready");
print("Sandbox MongoDB replica set ready");

// Root is used here only; applications authenticate against their own database.
const bootstrap = new Mongo("mongodb://mongo:27017/?directConnection=true");
bootstrap.getDB("admin").auth(process.env.MONGO_USERNAME, process.env.MONGO_PASSWORD);
for (const [domain, database] of [
  ["AUTH", "auth_sandbox"],
  ["TENANT", "tenant_sandbox"],
  ["DOCUMENT", "document_sandbox"]
]) {
  const target = bootstrap.getDB(database);
  const username = process.env[domain + "_MONGO_USERNAME"];
  const password = process.env[domain + "_MONGO_PASSWORD"];
  if (!username || !password || username === process.env.MONGO_USERNAME)
    throw new Error("Missing isolated application credentials");
  const existing = target.getUser(username);
  if (!existing)
    target.createUser({
      user: username,
      pwd: password,
      roles: [{ role: "readWrite", db: database }]
    });
  else if (
    existing.roles.length !== 1 ||
    existing.roles[0].role !== "readWrite" ||
    existing.roles[0].db !== database
  )
    throw new Error("Existing app roles differ; explicit operator migration is required");
  const verification = new Mongo("mongodb://mongo:27017/?directConnection=true");
  verification.getDB(database).auth(username, password);
  verification.getDB(database).getCollection("r1_readiness_probe").findOne({});
}
print("Three isolated MongoDB app accounts ready; existing roles/passwords were not changed");
