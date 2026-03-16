import logging
import httpx
from database import SessionLocal
from utils import get_config

logger = logging.getLogger(__name__)


def get_nc_config():
    db = SessionLocal()
    try:
        enabled = get_config(db, "nc_enabled")
        if enabled == "false":
            return None, None, None, None
        url = get_config(db, "nc_url")
        user = get_config(db, "nc_bot_user")
        password = get_config(db, "nc_bot_password")
        room_token = get_config(db, "nc_room_token")
        return url, user, password, room_token
    finally:
        db.close()


async def _get_or_create_direct_conversation(
    nc_url: str,
    auth: tuple[str, str],
    nc_username: str,
) -> str | None:
    """
    Возвращает token комнаты для личного чата с nc_username.
    Если комнаты нет — создаёт новую.
    """
    headers = {"OCS-APIRequest": "true", "Accept": "application/json"}
    async with httpx.AsyncClient(auth=auth, verify=False) as client:
        # Получаем список существующих комнат
        resp = await client.get(
            f"{nc_url}/ocs/v2.php/apps/spreed/api/v1/room",
            headers=headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            rooms = data.get("ocs", {}).get("data", [])
            for room in rooms:
                # type=1 — личный чат (одиночный)
                if room.get("type") == 1 and room.get("name") == nc_username:
                    return room.get("token")

        # Создаём новый личный чат
        resp = await client.post(
            f"{nc_url}/ocs/v2.php/apps/spreed/api/v1/room",
            headers=headers,
            json={
                "roomType": 1,
                "invite": nc_username,
            },
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return data.get("ocs", {}).get("data", {}).get("token")

    logger.error(f"Failed to get/create NC direct room for {nc_username}")
    return None


async def send_nc_message(
    room_token: str, message: str, nc_url: str, auth: tuple[str, str]
):
    """Отправляет сообщение в указанную комнату NextCloud Talk."""
    headers = {"OCS-APIRequest": "true", "Accept": "application/json"}
    async with httpx.AsyncClient(auth=auth, verify=False) as client:
        resp = await client.post(
            f"{nc_url}/ocs/v2.php/apps/spreed/api/v1/chat/{room_token}",
            headers=headers,
            json={"message": message},
        )
        if resp.status_code not in (200, 201):
            logger.error(f"NC Talk message failed [{resp.status_code}]: {resp.text}")


async def send_nc_admin_log(text: str):
    """Отправляет лог в общую комнату NextCloud Talk."""
    nc_url, nc_user, nc_password, room_token = get_nc_config()
    if not all([nc_url, nc_user, nc_password, room_token]):
        logger.debug("NC admin log skipped: NextCloud is not configured in settings")
        return
    auth = (nc_user, nc_password)
    try:
        await send_nc_message(
            room_token=room_token,
            message=f"🔔 Системное Логирование:\n{text}",
            nc_url=nc_url,
            auth=auth,
        )
        logger.info("NC admin log sent successfully")
    except Exception as e:
        logger.error(f"Failed to send NC admin log: {e}")


async def send_nc_notification(text: str, nc_username: str | None = None):
    """
    Отправляет уведомление через NextCloud Talk.
    Если nc_username задан — шлёт личным сообщением.
    Иначе — в общую комнату (nc_room_token).
    """
    nc_url, nc_user, nc_password, room_token = get_nc_config()
    if not all([nc_url, nc_user, nc_password]):
        logger.debug("NC notification skipped: NextCloud is not configured in settings")
        return
    auth = (nc_user, nc_password)

    target_token = room_token  # по умолчанию — общая комната

    if nc_username:
        logger.info(f"Getting/creating NC direct conversation for: {nc_username}")
        dm_token = await _get_or_create_direct_conversation(nc_url, auth, nc_username)
        if dm_token:
            target_token = dm_token
        else:
            logger.warning(
                f"Could not get DM room for {nc_username}, falling back to group room"
            )

    if not target_token:
        logger.warning("NC notification skipped: no room token available")
        return

    try:
        await send_nc_message(
            room_token=target_token,
            message=f"📨 Уведомление:\n{text}",
            nc_url=nc_url,
            auth=auth,
        )
        logger.info(f"NC notification sent to room: {target_token}")
    except Exception as e:
        logger.error(f"Failed to send NC notification: {e}")
