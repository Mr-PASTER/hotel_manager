from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Enum,
)
from sqlalchemy.orm import relationship
import enum
from database import Base


class RoomType(str, enum.Enum):
    single = "single"
    double = "double"
    suite = "suite"


class RoomStatus(str, enum.Enum):
    free = "free"
    occupied = "occupied"
    booked = "booked"
    cleaning = "cleaning"
    repair = "repair"


class EmployeeRole(str, enum.Enum):
    cleaner = "cleaner"
    repair = "repair"
    admin = "admin"


class BookingStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class AssignmentType(str, enum.Enum):
    cleaning = "cleaning"
    repair = "repair"


class NotificationPreference(str, enum.Enum):
    telegram = "telegram"
    nextcloud = "nextcloud"
    max = "max"
    all = "all"


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, unique=True, nullable=False)
    floor = Column(Integer, nullable=False)
    type = Column(Enum(RoomType), default=RoomType.single)
    status = Column(Enum(RoomStatus), default=RoomStatus.free)
    description = Column(String, default="")

    bookings = relationship(
        "Booking", back_populates="room", cascade="all, delete-orphan"
    )
    assignments = relationship(
        "RoomAssignment", back_populates="room", cascade="all, delete-orphan"
    )


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    role = Column(Enum(EmployeeRole), nullable=False)
    phone = Column(String, default="")
    active = Column(Boolean, default=True)
    username = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=True)
    telegram_username = Column(String, nullable=True)
    nextcloud_username = Column(String, nullable=True)
    max_username = Column(String, nullable=True)
    notification_preference = Column(
        Enum(NotificationPreference), default=NotificationPreference.all
    )

    assignments = relationship(
        "RoomAssignment", back_populates="employee", cascade="all, delete-orphan"
    )


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    source = Column(String, default="")
    comment = Column(String, default="")

    bookings = relationship(
        "Booking", back_populates="guest", cascade="all, delete-orphan"
    )


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)
    group_size = Column(Integer, default=1)
    status = Column(Enum(BookingStatus), default=BookingStatus.active)

    room = relationship("Room", back_populates="bookings")
    guest = relationship("Guest", back_populates="bookings")


class RoomAssignment(Base):
    __tablename__ = "room_assignments"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    type = Column(Enum(AssignmentType), nullable=False)
    note = Column(String, default="")
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    room = relationship("Room", back_populates="assignments")
    employee = relationship("Employee", back_populates="assignments")


class AppConfig(Base):
    __tablename__ = "app_config"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
