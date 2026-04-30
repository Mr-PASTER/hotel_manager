import random
from datetime import date

from app.api.deps import get_db, require_admin
from app.models.booking import Booking
from app.models.room import Room
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

BOOKING_COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#6366F1",
    "#84CC16",
]


def _random_color() -> str:
    return random.choice(BOOKING_COLORS)


async def _check_conflict(
    db: AsyncSession,
    room_id: str,
    start: date,
    end: date,
    exclude_id: str = None,
) -> bool:
    q = select(Booking).where(
        and_(
            Booking.room_id == room_id,
            ~or_(Booking.end_date < start, Booking.start_date > end),
        )
    )
    if exclude_id:
        q = q.where(Booking.id != exclude_id)
    result = await db.execute(q)
    return result.scalar_one_or_none() is not None


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    room_id: str = Query(None),
    from_date: date = Query(None, alias="from"),
    to_date: date = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(Booking)
    if room_id:
        q = q.where(Booking.room_id == room_id)
    if from_date:
        q = q.where(Booking.end_date >= from_date)
    if to_date:
        q = q.where(Booking.start_date <= to_date)
    result = await db.execute(q.order_by(Booking.start_date))
    return result.scalars().all()


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            404,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Бронирование не найдено"},
        )
    return booking


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    body: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    room_res = await db.execute(select(Room).where(Room.id == body.room_id))
    if not room_res.scalar_one_or_none():
        raise HTTPException(
            404,
            detail={"code": "ROOM_NOT_FOUND", "message": "Номер не найден"},
        )
    if await _check_conflict(db, body.room_id, body.start_date, body.end_date):
        raise HTTPException(
            409,
            detail={
                "code": "ROOM_CONFLICT",
                "message": "Номер уже забронирован на эти даты",
            },
        )
    booking = Booking(
        **body.model_dump(), color=_random_color(), created_by=current_user.id
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: str,
    body: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            404,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Бронирование не найдено"},
        )
    data = body.model_dump(exclude_unset=True)
    new_room_id = data.get("room_id", booking.room_id)
    new_start = data.get("start_date", booking.start_date)
    new_end = data.get("end_date", booking.end_date)
    if new_start >= new_end:
        raise HTTPException(
            400,
            detail={
                "code": "INVALID_DATES",
                "message": "start_date должна быть раньше end_date",
            },
        )
    if await _check_conflict(
        db, new_room_id, new_start, new_end, exclude_id=booking_id
    ):
        raise HTTPException(
            409,
            detail={
                "code": "ROOM_CONFLICT",
                "message": "Номер уже забронирован на эти даты",
            },
        )
    for field, value in data.items():
        setattr(booking, field, value)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.delete("/{booking_id}", status_code=204)
async def delete_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            404,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Бронирование не найдено"},
        )
    await db.delete(booking)
    await db.commit()
