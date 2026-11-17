"""Re-export health router for backwards compatibility."""
from app.api.controllers.health_controller import live, ready, router

__all__ = ["live", "ready", "router"]
