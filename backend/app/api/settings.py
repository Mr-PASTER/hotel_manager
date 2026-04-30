import httpx
from app.api.deps import get_db, require_admin
from app.core.security import decrypt_aes, encrypt_aes
from app.models.settings import AppSettings, NotificationTemplate, TemplateType
from app.models.user import User
from app.schemas.settings import (
    SettingsOut,
    SettingsUpdate,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/settings", tags=["settings"])


async def _get_or_create_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalar_one_or_none()
    if not s:
        s = AppSettings(
            id=1,
            nextcloud_url="",
            conversation_token="",
            bot_token_encrypted="",
            auto_notify=False,
        )
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


def _settings_to_out(s: AppSettings) -> dict:
    bot_token = ""
    if s.bot_token_encrypted:
        try:
            bot_token = decrypt_aes(s.bot_token_encrypted)
        except Exception:
            bot_token = ""
    return {
        "nextcloud_url": s.nextcloud_url or "",
        "conversation_token": s.conversation_token or "",
        "bot_token": bot_token,
        "auto_notify": s.auto_notify,
        "updated_at": s.updated_at,
    }


@router.get("", response_model=SettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await _get_or_create_settings(db)
    return _settings_to_out(s)


@router.patch("", response_model=SettingsOut)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await _get_or_create_settings(db)
    if body.nextcloud_url is not None:
        s.nextcloud_url = body.nextcloud_url
    if body.conversation_token is not None:
        s.conversation_token = body.conversation_token
    if body.bot_token is not None:
        s.bot_token_encrypted = encrypt_aes(body.bot_token) if body.bot_token else ""
    if body.auto_notify is not None:
        s.auto_notify = body.auto_notify
    await db.commit()
    await db.refresh(s)
    return _settings_to_out(s)


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(NotificationTemplate).order_by(NotificationTemplate.created_at)
    )
    return result.scalars().all()


@router.post("/templates", response_model=TemplateOut, status_code=201)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    tpl = NotificationTemplate(**body.model_dump(), is_default=False)
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.patch("/templates/{tpl_id}", response_model=TemplateOut)
async def update_template(
    tpl_id: str,
    body: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(NotificationTemplate).where(NotificationTemplate.id == tpl_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(
            404,
            detail={"code": "TEMPLATE_NOT_FOUND", "message": "Шаблон не найден"},
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tpl, field, value)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/templates/{tpl_id}", status_code=204)
async def delete_template(
    tpl_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(NotificationTemplate).where(NotificationTemplate.id == tpl_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(
            404,
            detail={"code": "TEMPLATE_NOT_FOUND", "message": "Шаблон не найден"},
        )
    if tpl.is_default:
        raise HTTPException(
            400,
            detail={
                "code": "CANNOT_DELETE_DEFAULT",
                "message": "Нельзя удалить системный шаблон",
            },
        )
    await db.delete(tpl)
    await db.commit()


@router.post("/test-notification")
async def test_notification(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    s = await _get_or_create_settings(db)
    if not s.nextcloud_url or not s.conversation_token or not s.bot_token_encrypted:
        raise HTTPException(
            400,
            detail={
                "code": "SETTINGS_INCOMPLETE",
                "message": "Nextcloud Talk не настроен",
            },
        )
    bot_token = decrypt_aes(s.bot_token_encrypted)
    url = (
        f"{s.nextcloud_url.rstrip('/')}/ocs/v2.php/apps/spreed/api/v1/bot"
        f"/{s.conversation_token}/message"
    )
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                url,
                json={"message": "Тестовое уведомление от Hotel Manager"},
                headers={
                    "Authorization": f"Bearer {bot_token}",
                    "OCS-APIRequest": "true",
                    "Content-Type": "application/json",
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
