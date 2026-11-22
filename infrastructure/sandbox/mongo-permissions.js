// Run only in the isolated sandbox; never log credentials.
const databases = ["auth_sandbox", "tenant_sandbox", "document_sandbox"];
const domains = ["AUTH", "TENANT", "DOCUMENT"];
for (let index = 0; index < domains.length; index++) {
  const connection = new Mongo("mongodb://mongo:27017/?directConnection=true");
  const own = connection.getDB(databases[index]);
  own.auth(
    process.env[domains[index] + "_MONGO_USERNAME"],
    process.env[domains[index] + "_MONGO_PASSWORD"]
  );
  own.getCollection("r1_permission_probe").findOne({});
  for (const other of databases.filter((name) => name !== databases[index])) {
    let denied = false;
    try {
      connection.getDB(other).getCollection("r1_permission_probe").findOne({});
    } catch (error) {
      if (error.code !== 13) throw error;
      denied = true;
    }
    if (!denied) throw new Error("Cross-database access was not denied");
  }
}
print("PASS: three own-database reads and six forbidden cross-database reads");
