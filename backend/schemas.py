from pydantic import BaseModel
from typing import Optional
from datetime import date
from models import RoomType, RoomStatus, EmployeeRole, BookingStatus, AssignmentType


# ─── Auth ────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


# ─── Room ────────────────────────────────────────────────────────────────────
class RoomBase(BaseModel):
    number: str
    floor: int
    type: RoomType = RoomType.single
    status: RoomStatus = RoomStatus.free
    description: str = ""


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    number: Optional[str] = None
    floor: Optional[int] = None
    type: Optional[RoomType] = None
    status: Optional[RoomStatus] = None
    description: Optional[str] = None


class RoomOut(RoomBase):
    id: int
    model_config = {"from_attributes": True}


# ─── Employee ─────────────────────────────────────────────────────────────────
class EmployeeBase(BaseModel):
    full_name: str
    role: EmployeeRole
    phone: str = ""
    active: bool = True
    telegram_username: Optional[str] = None
    nextcloud_username: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    username: Optional[str] = None
    password: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    telegram_username: Optional[str] = None
    nextcloud_username: Optional[str] = None


class EmployeeCredentialsUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


class EmployeeOut(EmployeeBase):
    id: int
    username: Optional[str] = None
    model_config = {"from_attributes": True}


# ─── Guest ────────────────────────────────────────────────────────────────────
class GuestBase(BaseModel):
    full_name: str
    source: str = ""
    comment: str = ""


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    full_name: Optional[str] = None
    source: Optional[str] = None
    comment: Optional[str] = None


class GuestOut(GuestBase):
    id: int
    model_config = {"from_attributes": True}


# ─── Booking ──────────────────────────────────────────────────────────────────
class BookingBase(BaseModel):
    room_id: int
    guest_id: Optional[int] = None
    check_in: date
    check_out: date
    group_size: int = 1
    status: BookingStatus = BookingStatus.active


class BookingCreate(BookingBase):
    # Поля для создания нового гостя при бронировании
    guest_full_name: Optional[str] = None
    guest_source: Optional[str] = ""
    guest_comment: Optional[str] = ""


class BookingUpdate(BaseModel):
    room_id: Optional[int] = None
    guest_id: Optional[int] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    group_size: Optional[int] = None
    status: Optional[BookingStatus] = None


class BookingOut(BookingBase):
    id: int
    model_config = {"from_attributes": True}


class BookingWithGuest(BaseModel):
    id: int
    room_id: int
    guest_id: Optional[int] = None
    guest_full_name: str
    check_in: date
    check_out: date
    group_size: int
    status: BookingStatus
    model_config = {"from_attributes": True}


# ─── Assignment ───────────────────────────────────────────────────────────────
class AssignmentBase(BaseModel):
    room_id: int
    employee_id: int
    date: date
    type: AssignmentType
    note: str = ""


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentOut(AssignmentBase):
    id: int
    employee_full_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ─── AppConfig ────────────────────────────────────────────────────────────────
class AppConfigOut(BaseModel):
    key: str
    value: str
    model_config = {"from_attributes": True}


class AppConfigUpdate(BaseModel):
    tg_bot_token: Optional[str] = None
    tg_group_chat_id: Optional[str] = None
    nc_url: Optional[str] = None
    nc_bot_user: Optional[str] = None
    nc_bot_password: Optional[str] = None
    nc_room_token: Optional[str] = None
