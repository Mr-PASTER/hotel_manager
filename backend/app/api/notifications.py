import base64
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.security import decrypt_aes
from app.models.settings import AppSettings, NotificationTemplate
from app.models.user import User
from app.schemas.notification import NotificationSend

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _render(template: str, vars: dict) -> str:
    def replacer(m):
        key = m.group(1)
        return vars.get(key, m.group(0))

    return re.sub(r"\{\{(\w+)\}\}", replacer, template)


def _basic_auth_header(login: str, password: str) -> str:
    creds = base64.b64encode(f"{login}:{password}".encode()).decode()
    return f"Basic {creds}"


async def _send_to_nextcloud(
    app_settings: AppSettings,
    tpl_type: str,
    vars: dict,
    db: AsyncSession,
) -> dict:
    """Send notification to all configured chats. Returns {"ok": True, "sent_to": N, "errors": [...]}"""
    tpl_res = await db.execute(
        select(NotificationTemplate)
        .where(NotificationTemplate.type == tpl_type)
        .order_by(NotificationTemplate.is_default.desc())
        .limit(1)
    )
    tpl = tpl_res.scalar_one_or_none()
    message = _render(tpl.template, vars) if tpl else f"[{tpl_type}] " + str(vars)
    nc_password = decrypt_aes(app_settings.nc_password_encrypted)

    tokens = (
        [t.strip() for t in app_settings.conversation_token.split(",") if t.strip()]
        if app_settings.conversation_token
        else []
    )

    sent_to = 0
    errors = []

    async with httpx.AsyncClient() as client:
        for token in tokens:
            url = (
                f"{app_settings.nextcloud_url.rstrip('/')}/ocs/v2.php/apps/spreed/api/v1/chat"
                f"/{token}"
            )
            try:
                resp = await client.post(
                    url,
                    json={"message": message},
                    headers={
                        "Authorization": _basic_auth_header(
                            app_settings.nc_login, nc_password
                        ),
                        "OCS-APIRequest": "true",
                    },
                    timeout=10,
                )
                resp.raise_for_status()
                sent_to += 1
            except httpx.HTTPError as e:
                import logging

                logger = logging.getLogger(__name__)
                logger.error(f"Failed to send notification to token {token}: {e}")
                errors.append({"token": token, "error": str(e)})

    return {"ok": True, "sent_to": sent_to, "errors": errors}


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
        or not app_settings.nc_login
        or not app_settings.nc_password_encrypted
    ):
        raise HTTPException(
            400,
            detail={
                "code": "SETTINGS_INCOMPLETE",
                "message": "Nextcloud Talk не настроен",
            },
        )

    if body.custom_text and body.type.value == "custom":
        nc_password = decrypt_aes(app_settings.nc_password_encrypted)
        tokens = (
            [t.strip() for t in app_settings.conversation_token.split(",") if t.strip()]
            if app_settings.conversation_token
            else []
        )

        sent_to = 0
        errors = []
        async with httpx.AsyncClient() as client:
            for token in tokens:
                url = (
                    f"{app_settings.nextcloud_url.rstrip('/')}/ocs/v2.php/apps/spreed/api/v1/chat"
                    f"/{token}"
                )
                try:
                    resp = await client.post(
                        url,
                        json={"message": body.custom_text},
                        headers={
                            "Authorization": _basic_auth_header(
                                app_settings.nc_login, nc_password
                            ),
                            "OCS-APIRequest": "true",
                        },
                        timeout=10,
                    )
                    resp.raise_for_status()
                    sent_to += 1
                except httpx.HTTPError as e:
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to send notification to token {token}: {e}")
                    errors.append({"token": token, "error": str(e)})

        return {"ok": True, "sent_to": sent_to, "errors": errors}

    vars = {
        "roomNumber": body.room_number or "",
        "guestName": body.guest_name or "",
        "startDate": body.start_date or "",
        "endDate": body.end_date or "",
    }
    result = await _send_to_nextcloud(app_settings, body.type.value, vars, db)
    return result
