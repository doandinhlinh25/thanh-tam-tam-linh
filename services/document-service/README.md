# Document Service

Spring Boot 3.5 / Java 21 implementation of `POST /api/v1/courses/{courseId}/documents` in `contracts/openapi/document.v1.yaml`.

Java packages under `com.linh.document`:

- `controller`: upload endpoint; `services.authorization`: course permission check before controller reads the file.
- `dto.request`, `dto.response`: request validation and public response models.
- `services.business`, `services.authorization`, `services.queue`, and `services.storage`: interfaces and their implementations; `utils`: job ID helper.
- `entity`, `constants`, `exception`: JPA document mapping, shared values, and error handling.
- `repository`: Spring Data JPA queries, including native `ON CONFLICT` statements for idempotent uploads and ingestion jobs.

`DocumentApplication` remains in the root package so Spring Boot can discover all components.

## Start

1. Create a PostgreSQL database and apply `database/migrations/001_document_upload.sql`.
2. Create a private S3 compatible bucket and provide Redis with Streams enabled.
3. Start Auth Service and Tenant Service. Set the environment variables in `.env.example` for Document Service. Its default `DOCUMENT_UPLOAD_AUTH_URL` is `http://localhost:4002/internal/authorization/course`.
4. Set `DOCUMENT_SERVICE_TOKEN` to the same private value in both Document Service and Tenant Service environments. Generate a value of at least 32 characters; do not commit the value. Tenant Service also needs its own `AUTH_TENANT_TOKEN` matching Auth Service.
5. Run `./mvnw spring-boot:run` (Windows: `.\mvnw.cmd spring-boot:run`).

The Maven Wrapper downloads its pinned Maven distribution automatically. Java 21 is required. Run tests with `./mvnw test` or `.\mvnw.cmd test`.

## Upload

```bash
curl -X POST 'http://localhost:8080/api/v1/courses/507f1f77bcf86cd799439011/documents' \
  -H 'Cookie: tokenAdmin=USER_SESSION' \
  -H 'Idempotency-Key: pdf-upload-1' \
  -F 'file=@example.pdf;type=application/pdf'
```

Replace the example course ID with the 24-character MongoDB ObjectId of an existing course and `USER_SESSION` with the `tokenAdmin` cookie returned by Auth Service login. The user must have upload permission for that course. The Spring MVC authorization interceptor sends the original session cookie and course ID to Tenant Service before the controller reads the multipart body. Tenant Service authenticates the Document Service token, validates the session through Auth Service, and checks course access. A successful response is `{"successful":true,"data":{"allowed":true,"tenantId":"...","userId":"..."}}`; missing or invalid credentials return HTTP 401 and insufficient course access returns HTTP 403. Tenant/user IDs supplied by the client are ignored. Kong authentication and routing still need configuration.

To verify the integration, upload a PDF with an authorized lecturer or tenant owner session and expect HTTP 202. Repeat without the cookie and expect HTTP 401; repeat with a valid session that lacks access to the course and expect HTTP 403. Only the authorized request should create document metadata, store the PDF, and publish an ingestion event. These checks require running Auth, Tenant, Document, PostgreSQL, Redis, and S3-compatible storage.

The PDF is stored privately under `tenantId/courseId/documentId/1.pdf`. Metadata is stored in PostgreSQL. An event matching `contracts/events/document-ingest-requested.v1.schema.json` is added to the Redis Stream `document-ingestion` in its `payload` field. Consumers must check the document and tenant again and handle `jobId` idempotently. If publication fails, the upload stays `UPLOADED`; retrying with the same key and bytes publishes it again. Configure Redis persistence for durable processing.

This implementation covers upload only. The contract's get, delete, retrieval, and PDF text-layer processing endpoints need separate implementation.
