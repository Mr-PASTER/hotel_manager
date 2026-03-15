from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import models
import schemas
from database import get_db
from dependencies import get_admin_user

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/", response_model=list[schemas.BookingWithGuest])
def get_calendar(
    start: Optional[date] = None,
    end: Optional[date] = None,
    room_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    query = db.query(models.Booking).filter(
        models.Booking.status != models.BookingStatus.cancelled
    )
    if start:
        query = query.filter(models.Booking.check_out >= start)
    if end:
        query = query.filter(models.Booking.check_in <= end)
    if room_id:
        query = query.filter(models.Booking.room_id == room_id)

    bookings = query.all()
    result = []
    for b in bookings:
        result.append(
            schemas.BookingWithGuest(
                id=b.id,
                room_id=b.room_id,
                guest_id=b.guest_id,
                guest_full_name=b.guest.full_name if b.guest else "—",
                check_in=b.check_in,
                check_out=b.check_out,
                group_size=b.group_size or 1,
                status=b.status,
            )
        )
    return result
