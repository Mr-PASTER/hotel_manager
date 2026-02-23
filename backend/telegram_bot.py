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
        token = get_config(db, "tg_bot_token")
        chat_id = get_config(db, "tg_group_chat_id")
        return token, chat_id
    finally:
        db.close()


async def send_admin_log(text: str):
    """Отправляет лог в общую группу как информационное сообщение."""
    global bot
    token, chat_id = get_tg_config()
    if not token or not chat_id:
        return

    if bot is None or bot.token != token:
        bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))

    try:
        await bot.send_message(
            chat_id=chat_id, text=f"🔔 <b>Системное Логирование:</b>\n{text}"
        )
    except Exception as e:
        logger.error(f"Failed to send admin log: {e}")


async def send_notification(text: str, require_response_from: str = None):
    """
    Отправляет уведомление в общую группу с кнопкой отклика для указанного сотрудника.
    require_response_from - username сотрудника без @
    """
    global bot
    token, chat_id = get_tg_config()
    if not token or not chat_id:
        return

    if bot is None or bot.token != token:
        bot = Bot(token=token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))

    reply_markup = None
    if require_response_from:
        from aiogram.utils.keyboard import InlineKeyboardBuilder

        builder = InlineKeyboardBuilder()
        builder.button(
            text="Откликнуться", callback_data=f"ack_{require_response_from}"
        )
        reply_markup = builder.as_markup()

    try:
        await bot.send_message(
            chat_id=chat_id,
            text=f"📨 <b>Уведомление:</b>\n{text}",
            reply_markup=reply_markup,
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")


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
