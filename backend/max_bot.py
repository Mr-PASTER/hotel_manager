"""
max_bot.py — ОТКЛЮЧЁН.
MAX-интеграция убрана. Файл оставлен как заглушка для совместимости.
"""
import logging
logger = logging.getLogger(__name__)


async def send_max_admin_log(text: str):
    logger.debug("MAX disabled. Skipped: send_max_admin_log")


async def send_max_personal_message(text: str, max_username: str = None):
    logger.debug("MAX disabled. Skipped: send_max_personal_message")
