from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.room import RoomStatus


class RoomCreate(BaseModel):
    number: str
    floor: int | None = None
    comment: str | None = None

    @field_validator("floor")
    @classmethod
    def floor_positive(cls, v):
        if v is not None and v < 1:
            raise ValueError("floor must be >= 1")
        return v


class RoomUpdate(BaseModel):
    number: str | None = None
    floor: int | None = None
    comment: str | None = None


class RoomStatusUpdate(BaseModel):
    status: RoomStatus


class RoomOut(BaseModel):
    id: str
    number: str
    floor: int | None = None
    comment: str | None = None
    status: RoomStatus
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
