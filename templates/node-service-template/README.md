# Node service template

Copy this directory to `services/<service-name>` and replace every
`__SERVICE_NAME__` token with the service name. Install dependencies from the
repository root with `npm ci`, then build and start the service's npm workspace.
Choose a distinct `HOST_PORT` in `.env.example`. The template's Compose file
uses the shared Node.js Dockerfile and the gateway network.

The service root follows the `duy-tam` layout: `index.ts`, `configs`,
`controllers`, `helpers`, `interface`, `middlewares`, `models`, `routes`,
`services`. It also keeps the Java framework's explicit
`dto/request`, `dto/response`, `repositories` and `exceptions` boundaries.

Keep the service-owned database diagram in `database/schema.dbml` and add
migrations to `database/migrations` when persistence is implemented.

Keep HTTP routes and controllers at the boundary. The health endpoint shows
route → controller → service → response DTO. Add request DTOs with validation,
business services, repositories and migrations inside the service as needed.
Business validation methods return `boolean`. Document exported functions and
classes with JSDoc. Keep named constants and configuration for route paths,
status codes and business values. The service owns its database and must never
query another service's database.

When exposing the service through Kong, add a route and trusted authorization
policy with tests. Keep protected routes denied until identity is verified.
