import httpx
from app.api.deps import get_current_user, get_db, require_admin
from app.core.security import decrypt_aes
from app.models.room import Room
from app.models.settings import AppSettings
from app.models.user import User
from app.schemas.room import RoomCreate, RoomOut, RoomStatusUpdate, RoomUpdate
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomOut])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Room).order_by(Room.floor, Room.number))
    return result.scalars().all()


@router.post("", response_model=RoomOut, status_code=201)
async def create_room(
    body: RoomCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = await db.execute(select(Room).where(Room.number == body.number))
    if existing.scalar_one_or_none():
        raise HTTPException(
            409,
            detail={
                "code": "ROOM_NUMBER_EXISTS",
                "message": "Номер с таким номером уже существует",
            },
        )
    room = Room(**body.model_dump())
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.patch("/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: str,
    body: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            404,
            detail={"code": "ROOM_NOT_FOUND", "message": "Номер не найден"},
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    await db.commit()
    await db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=204)
async def delete_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            404,
            detail={"code": "ROOM_NOT_FOUND", "message": "Номер не найден"},
        )
    await db.delete(room)
    await db.commit()


@router.patch("/{room_id}/status", response_model=RoomOut)
async def update_room_status(
    room_id: str,
    body: RoomStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            404,
            detail={"code": "ROOM_NOT_FOUND", "message": "Номер не найден"},
        )
    room.status = body.status
    await db.commit()
    await db.refresh(room)

    # autoNotify
    settings_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = settings_res.scalar_one_or_none()
    if app_settings and app_settings.auto_notify:
        try:
            from app.api.notifications import _send_to_nextcloud

            tpl_type = "clean_room" if body.status.value == "clean" else "dirty_room"
            await _send_to_nextcloud(
                app_settings, tpl_type, {"roomNumber": room.number}, db
            )
        except Exception:
            pass

    return room
