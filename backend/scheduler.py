import asyncio
import logging
from datetime import date

from database import SessionLocal
import models
from utils import get_config

logger = logging.getLogger(__name__)


async def check_today_assignments():
    """
    Проверяет назначения на сегодня и отправляет повторные уведомления
    сотрудникам, задания которых ещё не завершены.
    """
    db = SessionLocal()
    try:
        today = date.today()
        assignments = (
            db.query(models.RoomAssignment)
            .filter(
                models.RoomAssignment.date == today,
                models.RoomAssignment.completed.is_(False),
            )
            .all()
        )

        if not assignments:
            logger.debug("No pending assignments for today")
            return

        if get_config(db, "notify_reminders") == "false":
            logger.debug("Reminders notification is disabled")
            return

        for assignment in assignments:
            emp = assignment.employee
            room = (
                db.query(models.Room)
                .filter(models.Room.id == assignment.room_id)
                .first()
            )
            room_number = room.number if room else str(assignment.room_id)
            type_label = "Уборка" if assignment.type.value == "cleaning" else "Ремонт"

            tpl_reminder = get_config(db, "template_reminder") or "⏰ Напоминание! Сегодня ваш день выхода:\n\n🛏 Номер: #{number}\n🛠 Тип: {type}\n📅 Дата: {date}"
            reminder_msg = tpl_reminder.format(
                number=room_number,
                type=type_label,
                date=today.strftime('%d.%m.%Y')
            )

            if emp and emp.telegram_username:
                try:
                    from telegram_bot import send_personal_message

                    await send_personal_message(
                        reminder_msg, emp.telegram_username, assignment.id
                    )
                    logger.info(
                        f"Sent TG reminder for assignment {assignment.id} to {emp.telegram_username}"
                    )
                except Exception as e:
                    logger.error(f"Failed to send TG reminder: {e}")

            if emp and emp.nextcloud_username:
                try:
                    from nextcloud_bot import send_nc_notification

                    await send_nc_notification(
                        f"{reminder_msg}\n\n💬 Для завершения ответьте: Ок",
                        nc_username=emp.nextcloud_username,
                    )
                    logger.info(
                        f"Sent NC reminder for assignment {assignment.id} to {emp.nextcloud_username}"
                    )
                except Exception as e:
                    logger.error(f"Failed to send NC reminder: {e}")

            if emp and emp.max_username:
                try:
                    from max_bot import send_max_personal_message

                    await send_max_personal_message(
                        f"{reminder_msg}\n\n💬 Для завершения ответьте: Ок",
                        max_username=emp.max_username,
                    )
                    logger.info(
                        f"Sent MAX reminder for assignment {assignment.id} to {emp.max_username}"
                    )
                except Exception as e:
                    logger.error(f"Failed to send MAX reminder: {e}")

    finally:
        db.close()


async def scheduler_loop():
    """
    Запускает проверку каждый час.
    """
    logger.info("Assignment scheduler started")
    while True:
        try:
            await check_today_assignments()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        # Проверяем каждый час
        await asyncio.sleep(3600)
