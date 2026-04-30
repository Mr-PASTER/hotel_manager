from datetime import date, datetime

from pydantic import BaseModel, model_validator


class BookingCreate(BaseModel):
    room_id: str
    guest_name: str
    phone: str | None = None
    notes: str | None = None
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        return self


class BookingUpdate(BaseModel):
    guest_name: str | None = None
    phone: str | None = None
    notes: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    room_id: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date:
            if self.start_date >= self.end_date:
                raise ValueError("start_date must be before end_date")
        return self


class BookingOut(BaseModel):
    id: str
    room_id: str
    guest_name: str
    phone: str | None = None
    notes: str | None = None
    start_date: date
    end_date: date
    color: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
