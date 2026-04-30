import enum
import uuid
from datetime import datetime

from app.core.database import Base
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column


class RoomStatus(str, enum.Enum):
    clean = "clean"
    dirty = "dirty"


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    number: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RoomStatus] = mapped_column(
        SAEnum(RoomStatus), default=RoomStatus.clean, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
