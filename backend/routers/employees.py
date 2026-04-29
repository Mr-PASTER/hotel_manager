import models
import schemas
from database import get_db
from dependencies import get_admin_user
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from nextcloud_bot import send_nc_admin_log
from sqlalchemy.orm import Session
from utils import get_config
from routers.auth import get_password_hash

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("/", response_model=list[schemas.EmployeeOut])
def get_employees(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    return db.query(models.Employee).all()


@router.get("/{emp_id}", response_model=schemas.EmployeeOut)
def get_employee(emp_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return emp


@router.post("/", response_model=schemas.EmployeeOut, status_code=201)
def create_employee(
    data: schemas.EmployeeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    if data.username:
        existing = (
            db.query(models.Employee)
            .filter(models.Employee.username == data.username)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Логин уже занят")

    emp = models.Employee(
        full_name=data.full_name,
        role=data.role,
        phone=data.phone,
        active=data.active,
        username=data.username,
        hashed_password=get_password_hash(data.password) if data.password else None,
        telegram_username=data.telegram_username,
        nextcloud_username=data.nextcloud_username,
        max_username=data.max_username,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    if get_config(db, "notify_employee_changes") != "false":
        msg = f"👤 Добавлен новый сотрудник: {emp.full_name} ({emp.role.value})"
        background_tasks.add_task(send_nc_admin_log, msg)

    return emp


@router.put("/{emp_id}", response_model=schemas.EmployeeOut)
def update_employee(
    emp_id: int,
    data: schemas.EmployeeUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)

    if get_config(db, "notify_employee_changes") != "false":
        msg = f"👤 Изменён сотрудник: {emp.full_name} ({emp.role.value})"
        background_tasks.add_task(send_nc_admin_log, msg)

    return emp


@router.put("/{emp_id}/credentials", response_model=schemas.EmployeeOut)
def update_credentials(
    emp_id: int,
    data: schemas.EmployeeCredentialsUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if data.username is not None:
        conflict = (
            db.query(models.Employee)
            .filter(
                models.Employee.username == data.username,
                models.Employee.id != emp_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="Логин уже занят")
        emp.username = data.username
    if data.password is not None:
        emp.hashed_password = get_password_hash(data.password)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{emp_id}", status_code=204)
def delete_employee(
    emp_id: int, db: Session = Depends(get_db), _=Depends(get_admin_user)
):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    db.delete(emp)
    db.commit()
