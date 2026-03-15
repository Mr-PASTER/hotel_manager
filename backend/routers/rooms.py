from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date
import models
import schemas
from telegram_bot import send_admin_log
from nextcloud_bot import send_nc_admin_log
from max_bot import send_max_admin_log
from utils import get_config
from dependencies import get_current_user
from database import get_db

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def get_room_actual_status(
    room: models.Room, db: Session, current_date: date = None
) -> str:
    """Вычисляет актуальный статус номера на основе бронирований."""
    if current_date is None:
        current_date = date.today()

    # Проверяем активные бронирования
    today_booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.room_id == room.id,
            models.Booking.status == models.BookingStatus.active,
            models.Booking.check_in <= current_date,
            models.Booking.check_out > current_date,
        )
        .first()
    )

    if today_booking:
        return "occupied"  # Гость живёт в номере

    # Проверяем, выехал ли гость сегодня (номер нужно убрать)
    checkout_today = (
        db.query(models.Booking)
        .filter(
            models.Booking.room_id == room.id,
            models.Booking.status == models.BookingStatus.active,
            models.Booking.check_out == current_date,
        )
        .first()
    )

    if checkout_today:
        return "cleaning"  # Гость выехал, номер нужно убрать

    # Проверяем будущие бронирования
    future_booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.room_id == room.id,
            models.Booking.status == models.BookingStatus.active,
            models.Booking.check_in > current_date,
        )
        .first()
    )

    if future_booking:
        return "booked"  # Забронирован на будущую дату

    # Если статус repair в базе, сохраняем его
    if room.status == models.RoomStatus.repair:
        return "repair"

    return "free"


class RoomWithStatus(schemas.RoomOut):
    actual_status: str


@router.get("/", response_model=list[RoomWithStatus])
def get_rooms(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rooms = db.query(models.Room).all()
    result = []
    for room in rooms:
        room_dict = {
            "id": room.id,
            "number": room.number,
            "floor": room.floor,
            "type": room.type.value,
            "status": room.status.value,
            "description": room.description,
        }
        room_dict["actual_status"] = get_room_actual_status(room, db)
        result.append(room_dict)
    return result


@router.get("/{room_id}", response_model=schemas.RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")
    return room


@router.post("/", response_model=schemas.RoomOut, status_code=201)
def create_room(
    data: schemas.RoomCreate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    existing = db.query(models.Room).filter(models.Room.number == data.number).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Номер с таким обозначением уже существует"
        )
    room = models.Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.put("/{room_id}", response_model=schemas.RoomOut)
def update_room(
    room_id: int,
    data: schemas.RoomUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")

    old_status = room.status
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(room, key, value)

    if data.status and old_status != data.status:
        if get_config(db, "notify_room_changes") != "false":
            msg = f"🛠 Статус номера {room.number} изменён: {old_status.value} ➡ {data.status.value}"
            background_tasks.add_task(send_admin_log, msg)
            background_tasks.add_task(send_nc_admin_log, msg)
            background_tasks.add_task(send_max_admin_log, msg)

    db.commit()
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=204)
def delete_room(
    room_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")
    db.delete(room)
    db.commit()
