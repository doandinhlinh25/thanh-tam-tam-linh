"""Keep the Chat client aligned with the tracked Tenant OpenAPI contract."""

from pathlib import Path

import yaml

CONTRACT_PATH = (
    Path(__file__).parents[4]
    / "contracts"
    / "openapi"
    / "tenant-authorization.v1.yaml"
)


def test_tenant_authorization_contract_matches_client_wire_assumptions():
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    assert "/authorization/context" in contract["paths"]
    assert "/authorization/check" in contract["paths"]
    context = contract["paths"]["/authorization/context"]["post"]
    check = contract["paths"]["/authorization/check"]["post"]
    assert context["operationId"] == "resolveChatTenantContext"
    assert check["operationId"] == "checkChatCourseAuthorization"
    assert contract["security"] == [
        {"chatCredential": [], "userSession": []}
    ]
    assert {p["name"] for p in context["parameters"]} == {"X-CSRF-Token"}

    context_body = context["requestBody"]["content"]["application/json"]["schema"]
    check_body = check["requestBody"]["content"]["application/json"]["schema"]
    assert context_body["required"] == ["tenantId"]
    assert check_body["required"] == ["tenantId", "courseId", "action"]
    assert "chat:ask" in check_body["properties"]["action"]["enum"]

    reasons = contract["components"]["schemas"]["Failure"]["properties"]["reasonCode"]["enum"]
    assert set(reasons) == {
        "SESSION_INVALID",
        "SERVICE_CREDENTIAL_INVALID",
        "TENANT_ACCESS_DENIED",
        "COURSE_ACCESS_DENIED",
        "CSRF_INVALID",
        "AUTH_SERVICE_CREDENTIAL_INVALID",
        "AUTH_SERVICE_UNAVAILABLE",
        "AUTH_RESPONSE_INVALID",
    }
    for operation in (context, check):
        success = operation["responses"]["200"]["content"]["application/json"]["schema"]
        assert success["required"] == ["code", "successful", "data"]

