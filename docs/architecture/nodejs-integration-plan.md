# Node.js integration plan

This document describes the implemented Express foundation. The RAG MVP handbook
in `docs/documents/` describes proposed services and a possible NestJS migration;
NestJS is not installed or running in this repository. Keep npm workspaces,
`services/`, and Kong/OPA as the current integration baseline until the team
records a framework migration decision.

## Ownership

The Node.js services retain the boundaries documented in `service-boundaries.md`.
`identity-service` owns identity and authentication. `tenant-service` owns tenant
membership and tenant roles. Billing and notification own their respective data.
No service may read another service's database. Each service keeps its own DBML
and migrations as its database implementation is added.

## Shared packages

`packages/common` contains the framework-independent API response and ISO
timestamp contracts. `packages/http`
contains only HTTP setup, health reporting, configuration and error mapping.
Domain models, repositories, business rules and persistence stay inside their
own service. `contracts/openapi` is the wire contract for clients and services.

## Service layout

Each service follows the `duy-tam` layout at its root: `index.ts`, `configs`,
`controllers`, `helpers`, `interface`, `middlewares`, `models`, `routes`,
`services`. The Java framework's useful boundaries are retained
as `dto/request`, `dto/response`, `repositories` and `exceptions`. Request
DTOs keep their runtime validation alongside their types. `models`
contains service-owned domain or persistence models. Controllers handle HTTP;
business services enforce domain rules. Service validation methods return
`boolean` and use names such as `hasActiveMembership`. Public TypeScript
exports require JSDoc with parameters, return values and thrown errors where
applicable. Put business values, routes, status codes and messages in named
constants or configuration. Do not declare temporary variables inside loops.
Use `templates/node-service-template` when adding a service.

## Running

Install from the repository root with `npm ci`, then run `npm run build`
and `npm run typecheck`. Copy a service's `.env.example` to `.env` in that
service's directory and run its workspace `start` script. The generic container
build lives in `infrastructure/node`. Start the gateway Compose project first
to create the `saas-gateway` network, then start the Node Compose project.

Each health endpoint now passes through its service's route,
controller, service and response DTO. Database engines, migrations,
authentication and domain routes still require implementation. Kong/OPA is
default-deny. Protected routes must not be opened until authenticated identity
is established by a trusted component; client-supplied `x-authenticated-*`
headers are not an authentication source.
