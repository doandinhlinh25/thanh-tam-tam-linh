package saas.authz

import rego.v1

test_default_denies_request if {
  decision.allow == false
  decision.status == 403
}
