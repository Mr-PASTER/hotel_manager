import enum
import uuid
from datetime import datetime

from app.core.database import Base
from sqlalchemy import Boolean, Integer, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column


class TemplateType(str, enum.Enum):
    clean_room = "clean_room"
    dirty_room = "dirty_room"
    booking_created = "booking_created"
    booking_cancelled = "booking_cancelled"
    custom = "custom"


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    nextcloud_url: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    conversation_token: Mapped[str | None] = mapped_column(
        String, nullable=True, default=""
    )
    nc_login: Mapped[str | None] = mapped_column(
        String, nullable=True, default=""
    )
    nc_password_encrypted: Mapped[str | None] = mapped_column(
        String, nullable=True, default=""
    )
    auto_notify: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    template: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[TemplateType] = mapped_column(SAEnum(TemplateType), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
