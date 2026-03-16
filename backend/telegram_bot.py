import logging
from aiogram import Bot, Dispatcher, types
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from database import SessionLocal
from utils import get_config

logger = logging.getLogger(__name__)

dp = Dispatcher()
bot: Bot | None = None


def get_tg_config():
    db = SessionLocal()
    try:
        enabled = get_config(db, "tg_enabled")
        if enabled == "false":
            return None, None
        token = get_config(db, "tg_bot_token")
        chat_id = get_config(db, "tg_group_chat_id")
        return token, chat_id
    finally:
        db.close()


def _get_bot():
    global bot
    token, _ = get_tg_config()
    if not token:
        return None
    if bot is None or bot.token != token:
        bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    return bot


async def send_admin_log(text: str):
    """Отправляет лог в общую группу как информационное сообщение."""
    b = _get_bot()
    _, chat_id = get_tg_config()
    if not b or not chat_id:
        return

    try:
        await b.send_message(
            chat_id=chat_id, text=f"🔔 <b>Системное Логирование:</b>\n{text}"
        )
    except Exception as e:
        logger.error(f"Failed to send admin log: {e}")


async def send_notification(text: str, require_response_from: str = None):
    """
    Отправляет уведомление в общую группу с кнопкой отклика для указанного сотрудника.
    require_response_from - username сотрудника без @
    """
    b = _get_bot()
    _, chat_id = get_tg_config()
    if not b or not chat_id:
        return

    reply_markup = None
    if require_response_from:
        from aiogram.utils.keyboard import InlineKeyboardBuilder

        builder = InlineKeyboardBuilder()
        builder.button(
            text="Откликнуться", callback_data=f"ack_{require_response_from}"
        )
        reply_markup = builder.as_markup()

    try:
        await b.send_message(
            chat_id=chat_id,
            text=f"📨 <b>Уведомление:</b>\n{text}",
            reply_markup=reply_markup,
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")


async def send_personal_message(
    text: str, tg_username: str, assignment_id: int | None = None
):
    """
    Отправляет личное сообщение сотруднику через Telegram.
    Если указан assignment_id — добавляет кнопку "Завершено".
    """
    b = _get_bot()
    if not b:
        return

    try:
        # Получаем chat_id пользователя через updates (кэш бота)
        # Для ЛС нужно знать chat_id — отправляем в группу с упоминанием
        _, chat_id = get_tg_config()
        if not chat_id:
            return

        reply_markup = None
        if assignment_id is not None:
            from aiogram.utils.keyboard import InlineKeyboardBuilder

            builder = InlineKeyboardBuilder()
            builder.button(
                text="✅ Завершено",
                callback_data=f"done_{assignment_id}_{tg_username}",
            )
            reply_markup = builder.as_markup()

        mention = f"@{tg_username}" if tg_username else ""
        await b.send_message(
            chat_id=chat_id,
            text=f"📨 <b>Личное уведомление для {mention}:</b>\n{text}",
            reply_markup=reply_markup,
        )
    except Exception as e:
        logger.error(f"Failed to send personal message to {tg_username}: {e}")


@dp.callback_query(lambda c: c.data.startswith("ack_"))
async def process_ack(callback_query: types.CallbackQuery):
    target_username = callback_query.data.split("_", 1)[1]
    user_tg = callback_query.from_user.username

    if user_tg != target_username:
        await callback_query.answer("Это уведомление не для вас!", show_alert=True)
        return

    original_text = callback_query.message.text
    # Удаляем кнопку и добавляем статус "Принято"
    await callback_query.message.edit_text(
        f"{original_text}\n\n✅ <b>Принято в работу:</b> @{target_username}",
        reply_markup=None,
        parse_mode=ParseMode.HTML,
    )
    await callback_query.answer("Задача принята!")


@dp.callback_query(lambda c: c.data.startswith("done_"))
async def process_done(callback_query: types.CallbackQuery):
    """Обработчик кнопки Завершено — только назначенный сотрудник может нажать."""
    parts = callback_query.data.split("_", 2)
    if len(parts) < 3:
        await callback_query.answer("Ошибка данных", show_alert=True)
        return

    assignment_id = int(parts[1])
    target_username = parts[2]
    user_tg = callback_query.from_user.username

    if user_tg != target_username:
        await callback_query.answer(
            "Только назначенный сотрудник может завершить задание!", show_alert=True
        )
        return

    # Обновляем статус в БД
    from datetime import datetime
    import models

    db = SessionLocal()
    try:
        assignment = (
            db.query(models.RoomAssignment)
            .filter(models.RoomAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            await callback_query.answer("Назначение не найдено", show_alert=True)
            return
        if assignment.completed:
            await callback_query.answer("Задание уже завершено", show_alert=True)
            return

        assignment.completed = True
        assignment.completed_at = datetime.utcnow()

        # Обновляем статус комнаты
        room = (
            db.query(models.Room).filter(models.Room.id == assignment.room_id).first()
        )
        if room:
            room.status = models.RoomStatus.free

        db.commit()

        room_number = room.number if room else str(assignment.room_id)
        emp = assignment.employee

        # Убираем кнопку и пишем статус
        original_text = callback_query.message.text or ""
        await callback_query.message.edit_text(
            f"{original_text}\n\n✅ <b>Задание завершено:</b> @{target_username}\n"
            f"🕐 {assignment.completed_at.strftime('%d.%m.%Y %H:%M')}",
            reply_markup=None,
            parse_mode=ParseMode.HTML,
        )
        await callback_query.answer("Задание завершено! ✅")

        # Лог о завершении
        log_msg = (
            f"✅ Задание завершено!\n"
            f"Сотрудник: {emp.full_name if emp else 'N/A'}\n"
            f"Номер: #{room_number}\n"
            f"Завершено: {assignment.completed_at.strftime('%d.%m.%Y %H:%M')}"
        )
        try:
            _, chat_id = get_tg_config()
            b = _get_bot()
            if b and chat_id:
                await b.send_message(
                    chat_id=chat_id,
                    text=f"🔔 <b>Системное Логирование:</b>\n{log_msg}",
                )
        except Exception as e:
            logger.error(f"Failed to send completion log: {e}")

    finally:
        db.close()


async def start_bot():
    """Запускает поллинг бота в фоне."""
    global bot
    token, _ = get_tg_config()
    if not token:
        logger.warning("Telegram Bot Token is not configured. Bot will not start.")
        return

    if bot is None or bot.token != token:
        bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))

    logger.info("Starting Telegram Bot Polling...")
    try:
        await dp.start_polling(bot, handle_signals=False)
    except Exception as e:
        logger.error(f"Bot polling crashed: {e}")
