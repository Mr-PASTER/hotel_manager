from datetime import date
from typing import Optional

import models
import schemas
from database import get_db
from dependencies import get_current_user
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def check_overlapping_bookings(
    db: Session,
    room_id: int,
    check_in: date,
    check_out: date,
    exclude_id: Optional[int] = None,
) -> bool:
    """Проверяет, есть ли пересекающиеся брони для данного номера."""
    query = db.query(models.Booking).filter(
        models.Booking.room_id == room_id,
        models.Booking.status != models.BookingStatus.cancelled,
        # Пересечение: новая бронь начинается до того, как заканчивается существующая,
        # и заканчивается после того, как начинается существующая
        models.Booking.check_in < check_out,
        models.Booking.check_out > check_in,
    )
    if exclude_id:
        query = query.filter(models.Booking.id != exclude_id)
    return query.count() > 0


@router.get("/", response_model=list[schemas.BookingOut])
def get_bookings(
    room_id: Optional[int] = None,
    guest_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(models.Booking)
    if room_id:
        query = query.filter(models.Booking.room_id == room_id)
    if guest_id:
        query = query.filter(models.Booking.guest_id == guest_id)
    return query.all()


@router.get("/{booking_id}", response_model=schemas.BookingOut)
def get_booking(
    booking_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    return booking


@router.post("/", response_model=schemas.BookingOut, status_code=201)
def create_booking(
    data: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()

    # Проверка: даты не в прошлом
    if data.check_in < today:
        raise HTTPException(
            status_code=400, detail="Дата заезда не может быть в прошлом"
        )
    if data.check_out <= data.check_in:
        raise HTTPException(
            status_code=400, detail="Дата выезда должна быть позже даты заезда"
        )

    # Проверка: номер существует
    room = db.query(models.Room).filter(models.Room.id == data.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")

    # Обработка гостя: если guest_id не указан, создаём нового гостя
    guest_id = data.guest_id
    if not guest_id:
        # Требуется указать данные гостя
        if not data.guest_full_name:
            raise HTTPException(
                status_code=400,
                detail="Необходимо указать имя гостя или выбрать существующего",
            )
        # Создаём нового гостя
        new_guest = models.Guest(
            full_name=data.guest_full_name,
            source=data.guest_source or "",
            comment=data.guest_comment or "",
        )
        db.add(new_guest)
        db.commit()
        db.refresh(new_guest)
        guest_id = new_guest.id
    else:
        # Проверка: гость существует
        guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
        if not guest:
            raise HTTPException(status_code=404, detail="Гость не найден")

    # Проверка: нет ли пересекающихся броней
    if check_overlapping_bookings(db, data.room_id, data.check_in, data.check_out):
        raise HTTPException(
            status_code=400, detail="На эти даты уже есть бронирование этого номера"
        )

    booking = models.Booking(
        room_id=data.room_id,
        guest_id=guest_id,
        check_in=data.check_in,
        check_out=data.check_out,
        group_size=data.group_size,
        status=data.status,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.put("/{booking_id}", response_model=schemas.BookingOut)
def update_booking(
    booking_id: int,
    data: schemas.BookingUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")

    # Если меняем даты, проверяем корректность
    check_in = data.check_in if data.check_in is not None else booking.check_in
    check_out = data.check_out if data.check_out is not None else booking.check_out

    if check_out <= check_in:
        raise HTTPException(
            status_code=400, detail="Дата выезда должна быть позже даты заезда"
        )

    # Если меняем номер или даты, проверяем пересечения
    room_id = data.room_id if data.room_id is not None else booking.room_id
    if (
        data.room_id is not None
        or data.check_in is not None
        or data.check_out is not None
    ):
        if check_overlapping_bookings(
            db, room_id, check_in, check_out, exclude_id=booking_id
        ):
            raise HTTPException(
                status_code=400, detail="На эти даты уже есть бронирование этого номера"
            )

    for key, value in data.model_dump(exclude_none=True).items():
        setattr(booking, key, value)
    db.commit()
    db.refresh(booking)
    return booking


@router.delete("/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    db.delete(booking)
    db.commit()
