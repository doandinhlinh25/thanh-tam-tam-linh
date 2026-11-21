"""Wire models matching the Tenant authorization OpenAPI contract."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    field_validator,
)

ObjectId = Annotated[str, StringConstraints(pattern=r"^[a-fA-F0-9]{24}$")]
AuthorizationAction = Literal[
    "course:read",
    "document:read",
    "chat:ask",
    "feedback:write",
]


class AuthorizationReason(StrEnum):
    """Known reason codes returned by Auth and Tenant authorization services."""

    SESSION_INVALID = "SESSION_INVALID"
    SERVICE_CREDENTIAL_INVALID = "SERVICE_CREDENTIAL_INVALID"
    TENANT_ACCESS_DENIED = "TENANT_ACCESS_DENIED"
    COURSE_ACCESS_DENIED = "COURSE_ACCESS_DENIED"
    CSRF_INVALID = "CSRF_INVALID"
    AUTH_SERVICE_CREDENTIAL_INVALID = "AUTH_SERVICE_CREDENTIAL_INVALID"
    AUTH_SERVICE_UNAVAILABLE = "AUTH_SERVICE_UNAVAILABLE"
    AUTH_RESPONSE_INVALID = "AUTH_RESPONSE_INVALID"


class ContextRequest(BaseModel):
    """Exact request body for resolving Auth-verified tenant context."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    tenant_id: ObjectId = Field(alias="tenantId")


class CourseAuthorizationRequest(BaseModel):
    """Exact request body for an existing Tenant course permission check."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    tenant_id: ObjectId = Field(alias="tenantId")
    course_id: ObjectId = Field(alias="courseId")
    action: AuthorizationAction


class ContextData(BaseModel):
    """Verified identity, membership, and CSRF state returned by Tenant."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    allowed: StrictBool
    user_id: ObjectId = Field(alias="userId")
    tenant_id: ObjectId = Field(alias="tenantId")
    role: Literal["tenant_owner", "tenant_admin", "lecturer", "student"]
    csrf_verified: StrictBool = Field(alias="csrfVerified")

    @field_validator("allowed")
    @classmethod
    def must_be_allowed(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Tenant context did not allow the request")
        return value


class ContextSuccess(BaseModel):
    """Success envelope returned by POST /authorization/context."""

    model_config = ConfigDict(extra="ignore")

    code: Literal["success"]
    successful: StrictBool
    data: ContextData

    @field_validator("successful")
    @classmethod
    def must_be_successful(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Tenant context envelope was not successful")
        return value


class CourseAuthorizationData(BaseModel):
    """Allowed user and tenant returned by a course permission check."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    allowed: StrictBool
    user_id: ObjectId = Field(alias="userId")
    tenant_id: ObjectId = Field(alias="tenantId")

    @field_validator("allowed")
    @classmethod
    def must_be_allowed(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Tenant course check did not allow the request")
        return value


class CourseAuthorizationSuccess(BaseModel):
    """Success envelope returned by POST /authorization/check."""

    model_config = ConfigDict(extra="ignore")

    code: Literal["success"]
    successful: StrictBool
    data: CourseAuthorizationData

    @field_validator("successful")
    @classmethod
    def must_be_successful(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Tenant course envelope was not successful")
        return value


class FailureEnvelope(BaseModel):
    """Sanitized failure fields accepted from the internal contract."""

    model_config = ConfigDict(extra="ignore")

    code: Literal["error"]
    message: str
    reasonCode: AuthorizationReason | None = None
