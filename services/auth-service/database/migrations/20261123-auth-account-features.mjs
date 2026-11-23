import mongoose from "mongoose";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "AUTH_MIGRATION_URI=<Auth database> node 20261123-auth-account-features.mjs --dry-run|--apply"
  );
  console.log(
    "Dry-run is read-only. Apply creates indexes and backfills audit expiry. Never loads .env."
  );
} else {
  try {
    if (
      args.length !== 1 ||
      !["--dry-run", "--apply"].includes(args[0]) ||
      !process.env.AUTH_MIGRATION_URI
    )
      throw new Error("Invalid arguments or missing migration URI");
    await mongoose.connect(process.env.AUTH_MIGRATION_URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    const topology = await db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== "isdbgrid") throw new Error("Replica set required");
    const pending = await db
      .collection("auth_audit_logs")
      .countDocuments({ expiresAt: { $exists: false }, createdAt: { $type: "date" } });
    if (args[0] === "--apply") {
      const definitions = [
        [
          "auth_sessions",
          [
            { key: { tokenIdHash: 1 }, unique: true },
            { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
            { key: { userId: 1, createdAt: -1 } }
          ]
        ],
        ["auth_security", [{ key: { userId: 1 }, unique: true }]],
        [
          "auth_challenges",
          [
            { key: { tokenHash: 1 }, unique: true },
            { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
            { key: { userId: 1 } }
          ]
        ],
        [
          "email_change_tokens",
          [
            { key: { userId: 1 }, unique: true },
            { key: { tokenHash: 1 }, unique: true },
            { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
          ]
        ],
        [
          "auth_audit_logs",
          [
            { key: { userId: 1, action: 1, createdAt: -1 } },
            { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
          ]
        ]
      ];
      for (const [collection, indexes] of definitions)
        await db.collection(collection).createIndexes(indexes);
      await db
        .collection("auth_audit_logs")
        .updateMany({ expiresAt: { $exists: false }, createdAt: { $type: "date" } }, [
          { $set: { expiresAt: { $add: ["$createdAt", 90 * 86400000] } } }
        ]);
    }
    console.log(JSON.stringify({ mode: args[0], legacyAuditRecords: pending, result: "success" }));
  } catch {
    console.error(
      "Auth migration failed; verify arguments, replica set, permissions and index compatibility. Connection values are hidden."
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
