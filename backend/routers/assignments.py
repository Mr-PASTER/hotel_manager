from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import models
import schemas
from telegram_bot import send_admin_log, send_notification
from nextcloud_bot import send_nc_admin_log, send_nc_notification
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("/", response_model=list[schemas.AssignmentOut])
def get_assignments(
    room_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(models.RoomAssignment)
    if room_id:
        query = query.filter(models.RoomAssignment.room_id == room_id)
    if employee_id:
        query = query.filter(models.RoomAssignment.employee_id == employee_id)
    results = query.all()
    out = []
    for a in results:
        out.append(
            schemas.AssignmentOut(
                id=a.id,
                room_id=a.room_id,
                employee_id=a.employee_id,
                date=a.date,
                type=a.type,
                note=a.note,
                employee_full_name=a.employee.full_name if a.employee else None,
            )
        )
    return out


@router.post("/", response_model=schemas.AssignmentOut, status_code=201)
def create_assignment(
    data: schemas.AssignmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if not db.query(models.Room).filter(models.Room.id == data.room_id).first():
        raise HTTPException(status_code=404, detail="Номер не найден")
    emp = (
        db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    assignment = models.RoomAssignment(**data.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    background_tasks.add_task(
        send_admin_log,
        f"🏨 Новое назначение для {emp.full_name}:\nНомер {data.room_id}, тип: {data.type}",
    )
    background_tasks.add_task(
        send_nc_admin_log,
        f"🏨 Новое назначение для {emp.full_name}:\nНомер {data.room_id}, тип: {data.type}",
    )
    if emp.telegram_username:
        background_tasks.add_task(
            send_notification,
            f"Вам назначена новая задача!\n\n🛏 <b>Номер:</b> {data.room_id}\n🛠 <b>Тип:</b> {data.type}\n📅 <b>Дата:</b> {data.date}",
            require_response_from=emp.telegram_username,
        )
    if emp.nextcloud_username:
        background_tasks.add_task(
            send_nc_notification,
            f"Вам назначена новая задача!\n\nНомер: {data.room_id}\nТип: {data.type}\nДата: {data.date}",
            nc_username=emp.nextcloud_username,
        )

    return schemas.AssignmentOut(
        id=assignment.id,
        room_id=assignment.room_id,
        employee_id=assignment.employee_id,
        date=assignment.date,
        type=assignment.type,
        note=assignment.note,
        employee_full_name=emp.full_name,
    )


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    a = (
        db.query(models.RoomAssignment)
        .filter(models.RoomAssignment.id == assignment_id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    db.delete(a)
    db.commit()
