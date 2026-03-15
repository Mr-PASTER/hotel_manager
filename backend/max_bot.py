import logging
import httpx
from database import SessionLocal
from utils import get_config

logger = logging.getLogger(__name__)

def get_max_config():
    db = SessionLocal()
    try:
        token = get_config(db, "max_bot_token")
        chat_id = get_config(db, "max_group_chat_id")
        return token, chat_id
    finally:
        db.close()

async def send_max_message(bot_token: str, chat_id: str, message: str):
    """Отправляет сообщение через MAX API."""
    url = f"https://api.maxbot.ru/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message
    }
    
    async with httpx.AsyncClient(verify=False) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code not in (200, 201):
                logger.error(f"MAX message failed [{resp.status_code}]: {resp.text}")
            else:
                logger.info(f"MAX message sent to {chat_id}")
        except Exception as e:
            logger.error(f"MAX API Request Error: {e}")

async def send_max_admin_log(text: str):
    """Отправляет лог в общую группу MAX."""
    token, chat_id = get_max_config()
    if not token or not chat_id:
        logger.debug("MAX admin log skipped: bot token or group chat id not configured")
        return

    message = f"🔔 Системное Логирование:\n{text}"
    await send_max_message(token, chat_id, message)

async def send_max_personal_message(text: str, max_username: str | None = None):
    """
    Отправляет уведомление через MAX.
    Если указан max_username, шлет в личку (используя max_username как chat_id).
    Иначе шлет в общую группу.
    """
    token, group_chat_id = get_max_config()
    if not token:
        logger.debug("MAX direct message skipped: bot token not configured")
        return

    target_chat_id = max_username if max_username else group_chat_id
    
    if not target_chat_id:
        logger.warning("MAX notification skipped: no chat_id available")
        return
        
    message = f"📨 Уведомление:\n{text}"
    await send_max_message(token, target_chat_id, message)
