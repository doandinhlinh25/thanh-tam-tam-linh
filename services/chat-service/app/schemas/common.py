"""Common shared schemas and response envelopes."""
from typing import Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ApiSuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T

class ApiFailureDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None

class ApiFailureResponse(BaseModel):
    success: bool = False
    error: ApiFailureDetail
