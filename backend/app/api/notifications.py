import re

import httpx
from app.api.deps import get_current_user, get_db
from app.core.security import decrypt_aes
from app.models.settings import AppSettings, NotificationTemplate
from app.models.user import User
from app.schemas.notification import NotificationSend
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _render(template: str, vars: dict) -> str:
    def replacer(m):
        key = m.group(1)
        return vars.get(key, m.group(0))

    return re.sub(r"\{\{(\w+)\}\}", replacer, template)


async def _send_to_nextcloud(
    app_settings: AppSettings,
    tpl_type: str,
    vars: dict,
    db: AsyncSession,
) -> None:
    tpl_res = await db.execute(
        select(NotificationTemplate)
        .where(NotificationTemplate.type == tpl_type)
        .order_by(NotificationTemplate.is_default.desc())
        .limit(1)
    )
    tpl = tpl_res.scalar_one_or_none()
    message = _render(tpl.template, vars) if tpl else f"[{tpl_type}] " + str(vars)
    bot_token = decrypt_aes(app_settings.bot_token_encrypted)
    url = (
        f"{app_settings.nextcloud_url.rstrip('/')}/ocs/v2.php/apps/spreed/api/v1/bot"
        f"/{app_settings.conversation_token}/message"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={"message": message},
            headers={
                "Authorization": f"Bearer {bot_token}",
                "OCS-APIRequest": "true",
            },
            timeout=10,
        )
        resp.raise_for_status()


@router.post("/send")
async def send_notification(
    body: NotificationSend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = settings_res.scalar_one_or_none()
    if (
        not app_settings
        or not app_settings.nextcloud_url
        or not app_settings.conversation_token
        or not app_settings.bot_token_encrypted
    ):
        raise HTTPException(
            400,
            detail={
                "code": "SETTINGS_INCOMPLETE",
                "message": "Nextcloud Talk не настроен",
            },
        )

    if body.custom_text and body.type.value == "custom":
        bot_token = decrypt_aes(app_settings.bot_token_encrypted)
        url = (
            f"{app_settings.nextcloud_url.rstrip('/')}/ocs/v2.php/apps/spreed/api/v1/bot"
            f"/{app_settings.conversation_token}/message"
        )
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    url,
                    json={"message": body.custom_text},
                    headers={
                        "Authorization": f"Bearer {bot_token}",
                        "OCS-APIRequest": "true",
                    },
                    timeout=10,
                )
                resp.raise_for_status()
            except httpx.HTTPError as e:
                raise HTTPException(
                    502,
                    detail={"code": "NEXTCLOUD_ERROR", "message": str(e)},
                )
        return {"ok": True}

    vars = {
        "roomNumber": body.room_number or "",
        "guestName": body.guest_name or "",
        "startDate": body.start_date or "",
        "endDate": body.end_date or "",
    }
    try:
        await _send_to_nextcloud(app_settings, body.type.value, vars, db)
    except httpx.HTTPError as e:
        raise HTTPException(
            502,
            detail={"code": "NEXTCLOUD_ERROR", "message": str(e)},
        )
    return {"ok": True}
