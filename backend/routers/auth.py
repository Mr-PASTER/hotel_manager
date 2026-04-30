from datetime import datetime, timedelta, timezone
import os
import hashlib
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
import models
import schemas
from database import get_db
from dependencies import get_current_user

SECRET_KEY = os.environ.get("SECRET_KEY", "hotel-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

router = APIRouter(prefix="/api/auth", tags=["auth"])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pw_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return bcrypt.checkpw(pw_hash.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return bcrypt.hashpw(pw_hash.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_employee(token: str, db: Session) -> models.Employee:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    employee = (
        db.query(models.Employee).filter(models.Employee.username == username).first()
    )
    if employee is None:
        raise credentials_exception
    return employee


@router.post("/login", response_model=schemas.Token)
def login(
    data: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)
):
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.username == data.username)
        .first()
    )
    if not employee or not employee.hashed_password:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not verify_password(data.password, employee.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not employee.active:
        raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

    access_token = create_access_token(
        data={"sub": employee.username, "role": employee.role.value, "id": employee.id}
    )

    # На HTTPS (продакшн) нужны secure=True + samesite="none"
    # чтобы cookie передавался через Nginx reverse proxy
    is_https = os.environ.get("HTTPS_ENABLED", "true").lower() == "true"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=86400,  # 24 hours
        samesite="none" if is_https else "lax",
        secure=is_https,
        path="/",
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Успешный выход"}


@router.get("/me", response_model=schemas.EmployeeOut)
def get_me(current_user: models.Employee = Depends(get_current_user)):
    return current_user
