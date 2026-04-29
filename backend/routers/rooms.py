from datetime import date
from typing import Optional, List
from pydantic import BaseModel as PydanticModel

import models
import schemas
from database import get_db
from dependencies import get_current_user
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from nextcloud_bot import send_nc_admin_log, send_nc_message, get_nc_config
from sqlalchemy.orm import Session
from utils import get_config

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def get_room_actual_status(
    room: models.Room, db: Session, current_date: Optional[date] = None
) -> str:
    if current_date is None:
        current_date = date.today()

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
        return "occupied"

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
        return "booked"

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
            "clean_status": room.clean_status.value if room.clean_status else "clean",
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
        raise HTTPException(status_code=400, detail="Номер с таким обозначением уже существует")
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
            background_tasks.add_task(send_nc_admin_log, msg)

    db.commit()
    db.refresh(room)
    return room


@router.patch("/{room_id}/clean-status", response_model=schemas.RoomOut)
def update_clean_status(
    room_id: int,
    clean_status: models.RoomCleanStatus,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")
    room.clean_status = clean_status
    db.commit()
    db.refresh(room)
    return room


class BulkCleanStatusItem(PydanticModel):
    room_id: int
    clean_status: models.RoomCleanStatus


@router.post("/bulk-clean-status")
def bulk_update_clean_status(
    items: List[BulkCleanStatusItem],
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    for item in items:
        room = db.query(models.Room).filter(models.Room.id == item.room_id).first()
        if room:
            room.clean_status = item.clean_status
    db.commit()
    return {"status": "ok", "updated": len(items)}


@router.post("/send-status-report")
async def send_status_report(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Форматирует отчёт о статусе чистоты номеров по шаблону из настроек
    и отправляет в NextCloud Talk.
    """
    rooms = db.query(models.Room).order_by(models.Room.number).all()

    clean_rooms = [r for r in rooms if not r.clean_status or r.clean_status == models.RoomCleanStatus.clean]
    dirty_rooms = [r for r in rooms if r.clean_status == models.RoomCleanStatus.dirty]

    # Список номеров через запятую
    clean_list = ", ".join(f"№{r.number}" for r in clean_rooms) or "—"
    dirty_list = ", ".join(f"№{r.number}" for r in dirty_rooms) or "—"

    # Загружаем шаблон
    default_template = (
        "🏨 Статус уборки номеров\n\n"
        "✅ Чистые ({clean_count}):\n{clean_rooms}\n\n"
        "🧹 Требуют уборки ({dirty_count}):\n{dirty_rooms}"
    )
    template = get_config(db, "template_room_status") or default_template

    # Подставляем переменные
    message = template.format(
        clean_count=len(clean_rooms),
        dirty_count=len(dirty_rooms),
        total=len(rooms),
        clean_rooms=clean_list,
        dirty_rooms=dirty_list,
    )

    # Отправляем в NC Talk
    nc_url, nc_user, nc_password, room_token = get_nc_config()
    if not all([nc_url, nc_user, nc_password, room_token]):
        raise HTTPException(
            status_code=400,
            detail="NextCloud Talk не настроен. Проверьте настройки интеграции."
        )

    try:
        await send_nc_message(
            room_token=room_token,
            message=message,
            nc_url=nc_url,
            auth=(nc_user, nc_password),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки: {e}")

    return {"status": "ok", "clean": len(clean_rooms), "dirty": len(dirty_rooms)}


@router.delete("/{room_id}", status_code=204)
def delete_room(
    room_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")
    db.delete(room)
    db.commit()
