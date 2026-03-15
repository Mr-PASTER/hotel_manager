from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
import models
import schemas
from telegram_bot import send_admin_log, send_personal_message
from nextcloud_bot import send_nc_admin_log, send_nc_notification
from max_bot import send_max_admin_log, send_max_personal_message
from database import get_db
from dependencies import get_current_user
from utils import get_config

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
                completed=a.completed,
                completed_at=a.completed_at,
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
    if get_config(db, "notify_assignment_created") == "false":
        notify = False
    else:
        notify = True
    room = db.query(models.Room).filter(models.Room.id == data.room_id).first()
    if not room:
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

    type_label = "Уборка" if data.type == "cleaning" else "Ремонт"
    
    # Load templates from DB
    tpl_group = get_config(db, "template_assignment_group") or "🏨 Новое назначение для {name}:\nНомер #{number}, тип: {type}\n📅 Дата: {date}"
    tpl_personal = get_config(db, "template_assignment_personal") or "Вам назначена новая задача!\n\n🛏 Номер: #{number}\n🛠 Тип: {type}\n📅 Дата: {date}"

    group_msg = tpl_group.format(
        name=emp.full_name,
        number=room.number,
        type=type_label,
        date=data.date
    )
    personal_msg = tpl_personal.format(
        number=room.number,
        type=type_label,
        date=data.date
    )

    # 1) Уведомление в группу (TG + NC + MAX)
    if notify:
        background_tasks.add_task(send_admin_log, group_msg)
        background_tasks.add_task(send_nc_admin_log, group_msg)
        background_tasks.add_task(send_max_admin_log, group_msg)

        # 2) Личное сообщение сотруднику
        if emp.telegram_username:
            background_tasks.add_task(
                send_personal_message,
                personal_msg,
                emp.telegram_username,
                assignment.id,
            )
        if emp.nextcloud_username:
            background_tasks.add_task(
                send_nc_notification,
                f"{personal_msg}\n\n💬 Для завершения ответьте: Ок",
                nc_username=emp.nextcloud_username,
            )
        if emp.max_username:
            background_tasks.add_task(
                send_max_personal_message,
                f"{personal_msg}\n\n💬 Для завершения ответьте: Ок",
                max_username=emp.max_username,
            )

        # 3) Уведомления администраторам лично (по их предпочтениям)
        admins = (
            db.query(models.Employee)
            .filter(
                models.Employee.role == models.EmployeeRole.admin,
                models.Employee.active.is_(True),
            )
            .all()
        )
        admin_msg = (
            f"📋 Назначение создано:\n"
            f"Сотрудник: {emp.full_name}\n"
            f"Номер: #{room.number}, Тип: {type_label}\n"
            f"Дата: {data.date}"
        )
        for admin in admins:
            pref = admin.notification_preference or models.NotificationPreference.all
            if pref in (
                models.NotificationPreference.telegram,
                models.NotificationPreference.all,
            ):
                if admin.telegram_username:
                    background_tasks.add_task(
                        send_personal_message, admin_msg, admin.telegram_username
                    )
            if pref in (
                models.NotificationPreference.nextcloud,
                models.NotificationPreference.all,
            ):
                if admin.nextcloud_username:
                    background_tasks.add_task(
                        send_nc_notification,
                        admin_msg,
                        nc_username=admin.nextcloud_username,
                    )
            if pref in (
                models.NotificationPreference.max,
                models.NotificationPreference.all,
            ):
                if admin.max_username:
                    background_tasks.add_task(
                        send_max_personal_message,
                        admin_msg,
                        max_username=admin.max_username,
                    )

    return schemas.AssignmentOut(
        id=assignment.id,
        room_id=assignment.room_id,
        employee_id=assignment.employee_id,
        date=assignment.date,
        type=assignment.type,
        note=assignment.note,
        employee_full_name=emp.full_name,
        completed=assignment.completed,
        completed_at=assignment.completed_at,
    )


@router.post("/{assignment_id}/complete", response_model=schemas.AssignmentOut)
def complete_assignment(
    assignment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_user),
):
    a = (
        db.query(models.RoomAssignment)
        .filter(models.RoomAssignment.id == assignment_id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    if a.completed:
        raise HTTPException(status_code=400, detail="Задание уже завершено")

    a.completed = True
    a.completed_at = datetime.utcnow()

    # Обновляем статус комнаты на "свободен"
    room = db.query(models.Room).filter(models.Room.id == a.room_id).first()
    if room:
        room.status = models.RoomStatus.free

    db.commit()
    db.refresh(a)

    notify = get_config(db, "notify_assignment_completed") != "false"

    if notify:
        emp = a.employee
        tpl_completed = get_config(db, "template_assignment_completed") or "✅ Задание завершено!\nСотрудник: {name}\nНомер: #{number}\nЗавершено: {date}"
        
        log_msg = tpl_completed.format(
            name=emp.full_name if emp else 'N/A',
            number=room.number if room else a.room_id,
            date=a.completed_at.strftime('%d.%m.%Y %H:%M')
        )
        background_tasks.add_task(send_admin_log, log_msg)
        background_tasks.add_task(send_nc_admin_log, log_msg)
        background_tasks.add_task(send_max_admin_log, log_msg)

    return schemas.AssignmentOut(
        id=a.id,
        room_id=a.room_id,
        employee_id=a.employee_id,
        date=a.date,
        type=a.type,
        note=a.note,
        employee_full_name=emp.full_name if emp else None,
        completed=a.completed,
        completed_at=a.completed_at,
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
