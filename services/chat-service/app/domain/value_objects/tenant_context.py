"""TenantContext value object representing multi-tenant isolation context."""
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str
    course_id: Optional[str] = None
