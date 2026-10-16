"""Health endpoints không gọi provider."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings

router = APIRouter(tags=["health"])


@router.get("/health/live", summary="Liveness")
async def live() -> dict[str, str]:
    """Trả về alive khi tiến trình đang phục vụ HTTP."""
    return {"status": "alive"}


@router.get("/health/ready", summary="Readiness")
async def ready(settings: Settings = Depends(get_settings)) -> JSONResponse:
    """Kiểm tra cấu hình tại chỗ mà không gọi upstream."""
    if settings.is_ready():
        return JSONResponse(status_code=200, content={"status": "ready"})
    return JSONResponse(status_code=503, content={"status": "not_ready"})
