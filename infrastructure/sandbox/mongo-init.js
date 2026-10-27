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
