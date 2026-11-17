"""TenantContext value object representing multi-tenant isolation context."""
from dataclasses import dataclass


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str
    course_id: str | None = None
    request_id: str | None = None
