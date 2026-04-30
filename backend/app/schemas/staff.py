from datetime import datetime

from app.models.user import UserRole
from pydantic import BaseModel


class StaffCreate(BaseModel):
    login: str
    password: str
    role: UserRole
    name: str | None = None
    phone: str | None = None
    notes: str | None = None


class StaffUpdate(BaseModel):
    role: UserRole | None = None
    name: str | None = None
    phone: str | None = None
    notes: str | None = None


class StaffOut(BaseModel):
    id: str
    login: str
    role: UserRole
    name: str | None = None
    phone: str | None = None
    notes: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ResetPasswordResponse(BaseModel):
    new_password: str
