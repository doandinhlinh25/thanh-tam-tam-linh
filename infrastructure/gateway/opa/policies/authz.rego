package saas.authz

import rego.v1

default decision := {
    "allow": false,
    "status": 403,
    "message": "Access denied by authorization policy."
}
