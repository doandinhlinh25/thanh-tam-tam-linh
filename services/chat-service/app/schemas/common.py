"""Common shared schemas and response envelopes."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

class ApiSuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T

class ApiFailureDetail(BaseModel):
    code: str
    message: str
    details: dict | None = None

class ApiFailureResponse(BaseModel):
    success: bool = False
    error: ApiFailureDetail
