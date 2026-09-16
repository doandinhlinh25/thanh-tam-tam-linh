# Kong and OPA authorization

## Decision

Kong Gateway OSS is the edge gateway. Custom plugin `opa-authorizer` calls OPA for authorization decisions on protected routes.

## Responsibilities

- Kong routes requests, enforces gateway concerns and custom plugin `opa-authorizer` forwards protected requests to OPA.
- `identity-service` authenticates identity; it does not own tenant membership.
- `tenant-service` owns membership, role and tenant-scoped access facts.
- OPA evaluates policy from authenticated identity context and policy data.
- Business services remain responsible for their local domain invariants and must not trust client-provided authorization headers.

## Security rules

1. Start with default deny.
2. Do not expose Kong Admin API publicly.
3. Keep public identity routes separate from OPA-protected routes.
4. Do not let OPA query another service database directly.
5. Treat policies and their tests as versioned code reviewed with the service/API changes they protect.
