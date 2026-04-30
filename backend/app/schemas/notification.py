from app.models.settings import TemplateType
from pydantic import BaseModel


class NotificationSend(BaseModel):
    type: TemplateType
    room_number: str | None = None
    guest_name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    custom_text: str | None = None
