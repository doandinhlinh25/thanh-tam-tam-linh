"""Re-export health router for backwards compatibility."""
from app.api.controllers.health_controller import router, live, ready

__all__ = ["router", "live", "ready"]
