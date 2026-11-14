import { compose } from "../../scripts/sandbox.mjs";
import { validateRuntimeCredentials } from "./runtime-credentials.mjs";

/** Inspect only Document-owned data using its own credential, never Mongo root. */
export function documentRows(env, tenantId, courseId) {
  validateRuntimeCredentials(env);
  for (const id of [tenantId, courseId])
    if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Invalid sandbox scope");
  const code =
    'const d = new Mongo("mongodb://mongo:27017/?directConnection=true").getDB("document_sandbox");' +
    "d.auth(process.env.DOCUMENT_MONGO_USERNAME,process.env.DOCUMENT_MONGO_PASSWORD);" +
    'const rows=d.documents.find({tenantId:"' +
    tenantId +
    '",courseId:"' +
    courseId +
    '"}).toArray();' +
    "const docs=rows.map(d=>({document_id:d._id,tenant_id:d.tenantId,course_id:d.courseId,uploader_user_id:d.uploaderUserId,checksum_sha256:d.checksumSha256,storage_key:d.storageKey,status:d.status,file_name:d.fileName,byte_size:d.byteSize,idempotency_key:d.idempotencyKey,access_scope:d.accessScope,document_version:d.documentVersion,page_count:d.pageCount??null,failure_code:d.failureCode??null,created_at:d.createdAt,updated_at:d.updatedAt}));" +
    "const jobs=d.ingestion_jobs.countDocuments({documentId:{$in:rows.map(d=>d._id)}});print(JSON.stringify({documents:docs,jobs}));";
  return JSON.parse(
    compose(
      [
        "run",
        "--rm",
        "--no-deps",
        "--entrypoint",
        "mongosh",
        "mongo-init",
        "--quiet",
        "--nodb",
        "--eval",
        code
      ],
      env,
      true
    )
  );
}
