# Review PR #6 — sandbox Auth / Tenant / Document

Date: 2026-10-27. Base `625003d529af42b1a137c1b1e05d7e7a8b6b5b51`, head `c508949d9ce438f0aed4211bc05f4ff3687a0221` (`origin/pr-6`). PR is open. Review is read-only for implementation code.

## Summary and decision

**REQUEST CHANGES.** The first start of the Compose stack is blocked at MongoDB replica-set initialization. Auth and Tenant depend on that job completing, so the main acceptance path cannot run. The PR has no CI checks, and its description says the container stack and end-to-end smoke test were not run.

## Finding

### High — Confirmed defect — `infrastructure/sandbox/compose.yaml:57`

**Finding:** The `mongo-init` sidecar runs `mongosh --quiet --file /bootstrap/mongo-init.js` without `--nodb`, a URI, or `--host mongo`.

**Impact:** `mongosh` first attempts its default `localhost:27017` connection inside the sidecar, where there is no MongoDB server. It exits before the script's explicit `new Mongo("mongodb://mongo:27017/...")` can run. `mongo-init` cannot complete successfully; Auth and Tenant are held by their `depends_on` conditions at lines 138 and 159.

**Evidence:** The sidecar has its own container and no `mongod` process. MongoDB's [shell documentation](https://www.mongodb.com/docs/mongodb-shell/write-scripts/) explicitly says scripts that connect internally require `--nodb` to avoid the initial localhost connection. The [connection documentation](https://www.mongodb.com/docs/mongodb-shell/connect/) defines the default localhost behavior.

**Recommendation:** Add `--nodb` to the `mongosh` entrypoint (or supply a reachable MongoDB URI), then run `sandbox:up` from a fresh set of volumes and run `sandbox:smoke`.

## Requirement coverage

| Acceptance area | Result |
| --- | --- |
| Isolated Compose project, internal network, dedicated volumes, loopback published ports | Verified statically in the diff; runtime isolation unverified |
| Secret generation, separate Auth–Tenant and Tenant–Document tokens | Verified statically; existing file preservation covered by a unit test in the PR |
| MongoDB replica set and dependent service startup | Failed by the confirmed defect above |
| PostgreSQL schema, Redis, private S3 bucket, Document readiness | Configured statically; startup and behavior unverified |
| Course fixtures with lecturer and student sessions | API paths and payloads match the current service source; Docker execution unverified |
| End-to-end upload, idempotency, metadata, event, S3 access | Smoke script exists; execution unverified |

## Test evidence and remaining risk

`git diff --check 625003d...origin/pr-6` passed. GitHub reports no CI checks for this PR. Docker Engine is unavailable in this review environment, so container startup and smoke could not be rerun. The PR description reports Node and Document tests passing, but those results do not exercise this Compose startup path. No application files were modified during review.

After fixing the sidecar invocation, run `npm run sandbox:up`, `npm run sandbox:fixtures`, and `npm run sandbox:smoke` on a machine with Docker, and attach the command results to the PR. Re-review any failures or follow-up changes.
