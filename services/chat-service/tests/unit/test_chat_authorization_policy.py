"""Configuration and request-boundary policy tests for Chat authorization."""

import pytest

from app.core.config import Settings


def valid_settings(**changes: object) -> Settings:
    values: dict[str, object] = {
        "TENANT_SERVICE_URL": "http://tenant:8080",
        "CHAT_SERVICE_TOKEN": "t" * 40,
        "TENANT_AUTHORIZATION_TIMEOUT_SECONDS": 5.0,
        "CORS_ORIGINS": ["https://chat.example.test"],
    }
    values.update(changes)
    return Settings(**values)


def test_valid_authorization_settings_are_accepted() -> None:
    valid_settings().validate_chat_authorization()


@pytest.mark.parametrize(
    "changes",
    [
        {"TENANT_SERVICE_URL": ""},
        {"TENANT_SERVICE_URL": "file:///tmp/tenant"},
        {"TENANT_SERVICE_URL": "http://tenant:8080/internal"},
        {"TENANT_SERVICE_URL": "https://tenant.example:invalid"},
        {"TENANT_SERVICE_URL": "https://user:password@tenant.example"},
        {"CHAT_SERVICE_TOKEN": "short"},
        {"TENANT_AUTHORIZATION_TIMEOUT_SECONDS": 0},
        {"TENANT_AUTHORIZATION_TIMEOUT_SECONDS": -1},
        {"TENANT_AUTHORIZATION_TIMEOUT_SECONDS": float("inf")},
        {"CORS_ORIGINS": []},
        {"CORS_ORIGINS": ["*"]},
        {"CORS_ORIGINS": ["null"]},
        {"CORS_ORIGINS": ["https://chat.example.test/path"]},
        {"CORS_ORIGINS": ["https://chat.example.test:invalid"]},
    ],
)
def test_invalid_authorization_settings_fail_validation(changes: dict[str, object]) -> None:
    with pytest.raises(ValueError):
        valid_settings(**changes).validate_chat_authorization()


def test_service_token_secret_repr_is_redacted() -> None:
    settings = valid_settings(CHAT_SERVICE_TOKEN="private-service-credential-value")

    assert "private-service-credential-value" not in repr(settings.CHAT_SERVICE_TOKEN)
