from datetime import datetime, timedelta, timezone

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password,
)
from app.models.user import RefreshToken, User
from app.schemas.auth import LoginRequest, LoginResponse, UserOut
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from jose import JWTError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.login == body.login))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Неверный логин или пароль",
            },
        )
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    db.add(RefreshToken(user_id=user.id, token=refresh_token, expires_at=expires_at))
    await db.commit()
    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        secure=settings.NODE_ENV == "production",
    )
    return LoginResponse(accessToken=access_token, user=UserOut.model_validate(user))


@router.post("/refresh")
async def refresh(
    response: Response,
    refreshToken: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "INVALID_REFRESH_TOKEN",
            "message": "Недействительный refresh-токен",
        },
    )
    if not refreshToken:
        raise credentials_exception
    try:
        payload = decode_refresh_token(refreshToken)
        user_id: str = payload.get("sub")
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == refreshToken)
    )
    stored = result.scalar_one_or_none()
    if not stored or stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
        timezone.utc
    ):
        raise credentials_exception

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise credentials_exception

    new_access = create_access_token({"sub": user_id})
    return {"accessToken": new_access}


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refreshToken: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    if refreshToken:
        await db.execute(delete(RefreshToken).where(RefreshToken.token == refreshToken))
        await db.commit()
    response.delete_cookie("refreshToken")


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
