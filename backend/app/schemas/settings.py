from datetime import datetime

from app.models.settings import TemplateType
from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    nextcloud_url: str | None = None
    conversation_token: str | None = None
    bot_token: str | None = None
    auto_notify: bool | None = None


class SettingsOut(BaseModel):
    nextcloud_url: str
    conversation_token: str
    bot_token: str  # masked or actual depending on use
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
