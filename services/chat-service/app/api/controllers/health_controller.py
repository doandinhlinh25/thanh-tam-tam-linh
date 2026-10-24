"""Health check controller."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from app.core.config import Settings, get_settings

router = APIRouter()


@router.get("")
async def get_health():
    return {"status": "ok", "service": "chat-service"}


@router.get("/live", summary="Liveness")
async def live() -> dict[str, str]:
    """Trả về alive khi tiến trình đang phục vụ HTTP."""
    return {"status": "alive"}


@router.get("/ready", summary="Readiness")
async def ready(settings: Settings = Depends(get_settings)) -> JSONResponse:
    """Kiểm tra cấu hình tại chỗ mà không gọi upstream."""
    if settings.is_ready():
        return JSONResponse(status_code=200, content={"status": "ready"})
    return JSONResponse(status_code=503, content={"status": "not_ready"})
