from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import models
from database import get_db

SECRET_KEY = "hotel-secret-key-change-in-production-2024"
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.Employee:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = None
    if credentials:
        token = credentials.credentials
    else:
        # Check cookies
        token = request.cookies.get("access_token")

    if not token:
        raise credentials_exception

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
    if not employee.active:
        raise credentials_exception

    # Store user data as a dict to avoid DetachedInstanceError in middleware
    request.state.user_data = {
        "id": employee.id,
        "username": employee.username,
        "role": employee.role.value,
    }
    request.state.user = employee
    return employee


def get_admin_user(user: models.Employee = Depends(get_current_user)):
    """Зависимость, которая разрешает доступ только администраторам."""
    if user.role != models.EmployeeRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только для администраторов",
        )
    return user
