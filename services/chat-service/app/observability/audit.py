"""Audit logging for compliance, tenant context and safety tracing."""
from app.core.logging import logger

def audit_log(event_type: str, tenant_id: str, user_id: str, details: dict):
    logger.info(
        f"[AUDIT] event={event_type} tenant={tenant_id} user={user_id} details={details}"
    )
