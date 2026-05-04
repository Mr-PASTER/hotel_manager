from datetime import datetime

from app.models.settings import TemplateType
from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    nextcloud_url: str | None = None
    conversation_token: str | None = None
    nc_login: str | None = None
    nc_password: str | None = None
    auto_notify: bool | None = None


class SettingsOut(BaseModel):
    nextcloud_url: str
    conversation_token: str
    nc_login: str
    nc_password: str  # decrypted for display
    auto_notify: bool
    updated_at: datetime
    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str
    template: str
    type: TemplateType


class TemplateUpdate(BaseModel):
    name: str | None = None
    template: str | None = None


class TemplateOut(BaseModel):
    id: str
    name: str
    template: str
    type: TemplateType
    is_default: bool
    created_at: datetime
    model_config = {"from_attributes": True}
