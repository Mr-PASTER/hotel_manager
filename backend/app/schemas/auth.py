from app.models.user import UserRole
from pydantic import BaseModel


class LoginRequest(BaseModel):
    login: str
    password: str


class RefreshRequest(BaseModel):
    pass  # token comes from httpOnly cookie


class UserOut(BaseModel):
    id: str
    login: str
    role: UserRole
    name: str | None = None
    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    accessToken: str
    user: UserOut
