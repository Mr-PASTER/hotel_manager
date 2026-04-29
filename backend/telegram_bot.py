"""
telegram_bot.py — ОТКЛЮЧЁН.
Telegram-интеграция убрана. Файл оставлен как заглушка для совместимости.
"""
import logging
logger = logging.getLogger(__name__)


async def send_admin_log(text: str):
    logger.debug("Telegram disabled. Skipped: send_admin_log")


async def send_notification(text: str, require_response_from: str = None):
    logger.debug("Telegram disabled. Skipped: send_notification")


async def send_personal_message(text: str, tg_username: str, assignment_id=None):
    logger.debug("Telegram disabled. Skipped: send_personal_message")


async def start_bot():
    logger.info("Telegram bot is disabled.")
