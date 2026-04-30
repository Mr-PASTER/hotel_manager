import random
import string

from app.api.deps import get_db, require_admin
from app.core.security import hash_password
from app.models.user import User
from app.schemas.staff import ResetPasswordResponse, StaffCreate, StaffOut, StaffUpdate
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/staff", tags=["staff"])


def _gen_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


@router.get("", response_model=list[StaffOut])
async def list_staff(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=StaffOut, status_code=201)
async def create_staff(
    body: StaffCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.login == body.login))
    if existing.scalar_one_or_none():
        raise HTTPException(
            409,
            detail={"code": "LOGIN_EXISTS", "message": "Логин уже занят"},
        )
    user = User(
        login=body.login,
        password_hash=hash_password(body.password),
        role=body.role,
        name=body.name,
        phone=body.phone,
        notes=body.notes,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=StaffOut)
async def update_staff(
    user_id: str,
    body: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            404,
            detail={"code": "USER_NOT_FOUND", "message": "Пользователь не найден"},
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_staff(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(
            400,
            detail={"code": "CANNOT_DELETE_SELF", "message": "Нельзя удалить себя"},
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            404,
            detail={"code": "USER_NOT_FOUND", "message": "Пользователь не найден"},
        )
    await db.delete(user)
    await db.commit()


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            404,
            detail={"code": "USER_NOT_FOUND", "message": "Пользователь не найден"},
        )
    new_pw = _gen_password()
    user.password_hash = hash_password(new_pw)
    await db.commit()
    return ResetPasswordResponse(new_password=new_pw)
