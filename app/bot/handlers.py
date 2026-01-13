import logging
from aiogram import Router, F, types
from aiogram.types import CallbackQuery
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Nomer, StatusNomera, User
from .callbacks import TaskCallback

router = Router()

@router.message(F.text == "/start")
async def cmd_start(message: types.Message):
    """
    Приветственное сообщение. Позволяет узнать свой ID.
    """
    await message.answer(
        f"Привет! Я бот отеля.\nТвой Telegram ID: <code>{message.from_user.id}</code>\n"
        "Сообщи этот ID администратору для настройки уведомлений.",
        parse_mode="HTML"
    )

@router.callback_query(TaskCallback.filter(F.action == "done"))
async def on_task_done(callback: CallbackQuery, callback_data: TaskCallback):
    """
    Обработка нажатия кнопки "Работа выполнена".
    """
    room_id = callback_data.room_id
    task_type = callback_data.task_type
    
    async with SessionLocal() as session:
        # Ищем комнату
        room = await session.get(Nomer, room_id)
        if not room:
            await callback.answer("Ошибка: Номер не найден", show_alert=True)
            return

        # Логика обновления статуса
        old_status = room.status
        new_status = old_status
        
        if task_type == "cleaning":
            # Если была уборка, ставим "Убрана" (CHISTO)
            new_status = StatusNomera.CHISTO
            # Снимаем ответственного
            room.otvetstvenniy = None
            
        elif task_type == "repair":
            # Если был ремонт, обычно после ремонта нужно убраться
            new_status = StatusNomera.TREBUET_UBORKI
            # Снимаем ответственного (ремонтника)
            room.otvetstvenniy = None
        
        # Запоминаем данные номера до коммита, так как после commit() объект может быть expired
        room_number = room.nomer_komnati
        
        room.status = new_status
        await session.commit()
        
        # Обновляем сообщение
        status_text = "Чисто" if new_status == StatusNomera.CHISTO else "Требует уборки"
        
        # Определяем название задачи для истории
        task_name = "УБОРКА" if task_type == "cleaning" else "РЕМОНТ"

        try:
            # Удаляем исходное сообщение с кнопкой
            await callback.message.delete()
            
            # Отправляем новое сообщение о результате
            result_text = (
                f"✅ <b>ВЫПОЛНЕНО: {task_name}</b>\n"
                f"🏨 Номер: <b>{room_number}</b>\n"
                f"Статус установлен: {status_text}"
            )
            
            await callback.message.answer(
                text=result_text,
                parse_mode="HTML"
            )
        except Exception as e:
            logging.error(f"Error updating message: {e}")
            
        await callback.answer("Статус обновлен!")
        
        # Уведомляем администраторов
        # Импорт внутри функции чтобы избежать circular import
        from .service import bot_service
        
        # Получаем имя сотрудника для лога
        performer_name = f"ID: {callback.from_user.id}"
        if callback.from_user.username:
            performer_name = f"@{callback.from_user.username}"
        elif callback.from_user.full_name:
            performer_name = callback.from_user.full_name
            
        auth_user = None
        # Попробуем найти сотрудника в БД по ID
        async with SessionLocal() as session:
            stmt = select(User).where(User.telegram_id == str(callback.from_user.id))
            res = await session.execute(stmt)
            auth_user = res.scalars().first()
        
        if auth_user:
            performer_name = f"{auth_user.full_name} ({auth_user.role})"

        log_text = (
            f"🔔 <b>ЛОГ: ЗАДАЧА ВЫПОЛНЕНА</b>\n"
            f"👤 Сотрудник: {performer_name}\n"
            f"🏨 Номер: {room_number}\n"
            f"🛠 Тип: {task_name}"
        )
        await bot_service.notify_admins(log_text)
