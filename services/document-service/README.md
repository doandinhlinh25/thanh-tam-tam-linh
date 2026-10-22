# Document Service

Spring Boot 3.5 / Java 21 implementation of `POST /api/v1/courses/{courseId}/documents` in `contracts/openapi/document.v1.yaml`.

Java packages under `com.linh.document`:

- `controller`, `filter`: upload endpoint and early course authorization.
- `dto.request`, `dto.response`: request validation and public response models.
- `services.business`, `services.authorization`, `services.persistence`, `services.queue`, and `services.storage`: each package owns its interface and an `impl` subpackage for its implementation; `utils`: job ID helper.
- `entity`, `constants`, `exception`: JPA document mapping, shared values, and error handling.
- `repository`: Spring Data JPA lookups. The PostgreSQL adapter uses native `ON CONFLICT` statements to preserve idempotent uploads and ingestion jobs.

`DocumentApplication` remains in the root package so Spring Boot can discover all components.

## Start

1. Create a PostgreSQL database and apply `database/migrations/001_document_upload.sql`.
2. Create a private S3 compatible bucket and provide Redis with Streams enabled.
3. Set the environment variables in `.env.example`. Configure the internal Tenant Service authorization endpoint and shared service token.
4. Run `./mvnw spring-boot:run` (Windows: `.\mvnw.cmd spring-boot:run`).

The Maven Wrapper downloads its pinned Maven distribution automatically. Java 21 is required. Run tests with `./mvnw test` or `.\mvnw.cmd test`.

## Upload

```bash
curl -X POST 'http://localhost:8080/api/v1/courses/course-1/documents' \
  -H 'Cookie: tokenAdmin=USER_JWT' \
  -H 'Idempotency-Key: pdf-upload-1' \
  -F 'file=@example.pdf;type=application/pdf'
```

The authorization filter sends the original session cookie and course ID to the configured internal Tenant Service endpoint before parsing the multipart body. Its successful response must be `{"successful":true,"data":{"allowed":true,"tenantId":"...","userId":"..."}}`; unauthorized and forbidden responses use HTTP 401 and 403. Tenant/user IDs from the client are ignored. The endpoint must authenticate the service token, validate the user session, and check course access. Tenant implements this endpoint at /internal/authorization/course; set DOCUMENT_UPLOAD_AUTH_URL to its internal address and give Tenant/Document the same DOCUMENT_SERVICE_TOKEN.

The PDF is stored privately under `tenantId/courseId/documentId/1.pdf`. Metadata is stored in PostgreSQL. An event matching `contracts/events/document-ingest-requested.v1.schema.json` is added to the Redis Stream `document-ingestion` in its `payload` field. Consumers must check the document and tenant again and handle `jobId` idempotently. If publication fails, the upload stays `UPLOADED`; retrying with the same key and bytes publishes it again. Configure Redis persistence for durable processing.

This implementation covers upload only. The contract's get, delete, retrieval, and PDF text-layer processing endpoints need separate implementation.

## Isolated integration environment

From the repository root, run npm run sandbox:init, npm run sandbox:up, then npm run sandbox:smoke. See [sandbox setup](../../infrastructure/sandbox/README.md). GET /health/live reports liveness; GET /health/ready checks PostgreSQL schema, Redis and S3 bucket access.
