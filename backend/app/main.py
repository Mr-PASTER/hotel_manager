from contextlib import asynccontextmanager

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select, text

from app.api import auth, bookings, notifications, rooms, staff
from app.api import settings as settings_router
from app.api import admin as admin_router
from app.core.config import settings
from app.core.limiter import limiter
from app.core.database import AsyncSessionLocal, Base, engine
from app.models.booking import Booking
from app.models.room import Room
from app.models.settings import AppSettings, NotificationTemplate, TemplateType
from app.models.user import RefreshToken, User, UserRole

DEFAULT_TEMPLATES = [
    {
        "name": "Номер убран",
        "type": TemplateType.clean_room,
        "template": "Номер {{roomNumber}} убран и готов к заселению.",
        "is_default": True,
    },
    {
        "name": "Номер грязный",
        "type": TemplateType.dirty_room,
        "template": "Требуется уборка номера {{roomNumber}}.",
        "is_default": True,
    },
    {
        "name": "Новое бронирование",
        "type": TemplateType.booking_created,
        "template": "Новое бронирование: номер {{roomNumber}}, гость {{guestName}}, с {{startDate}} по {{endDate}}.",
        "is_default": True,
    },
    {
        "name": "Отмена бронирования",
        "type": TemplateType.booking_cancelled,
        "template": "Бронирование отменено: номер {{roomNumber}}, гость {{guestName}}.",
        "is_default": True,
    },
]


logger = logging.getLogger(__name__)


async def _safe_migrate(conn) -> None:
    """
    Incremental schema migrations that run at every startup.
    Safe to run multiple times (idempotent).
    Handles both PostgreSQL and SQLite.
    """
    db_url = settings.DATABASE_URL

    if "postgresql" in db_url:
        # Add new columns (IF NOT EXISTS is supported since PG 9.6)
        await conn.execute(text(
            "ALTER TABLE app_settings "
            "ADD COLUMN IF NOT EXISTS nc_login VARCHAR DEFAULT ''"
        ))
        await conn.execute(text(
            "ALTER TABLE app_settings "
            "ADD COLUMN IF NOT EXISTS nc_password_encrypted VARCHAR DEFAULT ''"
        ))
        # Drop legacy bot_token_encrypted only if it still exists
        await conn.execute(text("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'app_settings'
                      AND column_name = 'bot_token_encrypted'
                ) THEN
                    ALTER TABLE app_settings DROP COLUMN bot_token_encrypted;
                END IF;
            END $$;
        """))
        logger.info("PostgreSQL schema migration completed")

    elif "sqlite" in db_url:
        result = await conn.execute(text("PRAGMA table_info(app_settings)"))
        existing = {row[1] for row in result.fetchall()}
        if "nc_login" not in existing:
            await conn.execute(text(
                "ALTER TABLE app_settings ADD COLUMN nc_login VARCHAR DEFAULT ''"
            ))
        if "nc_password_encrypted" not in existing:
            await conn.execute(text(
                "ALTER TABLE app_settings "
                "ADD COLUMN nc_password_encrypted VARCHAR DEFAULT ''"
            ))
        # SQLite DROP COLUMN supported since 3.35 — skip for safety
        logger.info("SQLite schema migration completed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create tables for new installations
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 2. Migrate existing tables (idempotent)
        await _safe_migrate(conn)

    # Seed initial data
    async with AsyncSessionLocal() as db:
        # Seed settings singleton
        s_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        if not s_res.scalar_one_or_none():
            db.add(
                AppSettings(
                    id=1,
                    nextcloud_url="",
                    conversation_token="",
                    nc_login="",
                    nc_password_encrypted="",
                    auto_notify=False,
                )
            )

        # Seed default notification templates
        for tpl_data in DEFAULT_TEMPLATES:
            t_res = await db.execute(
                select(NotificationTemplate).where(
                    NotificationTemplate.type == tpl_data["type"],
                    NotificationTemplate.is_default == True,  # noqa: E712
                )
            )
            if not t_res.scalar_one_or_none():
                db.add(NotificationTemplate(**tpl_data))

        await db.commit()

    yield



app = FastAPI(
    title="Hotel Manager API",
    version="1.0.0",
    description="Backend API для системы управления отелем",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    message = "; ".join(
        f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}" for e in errors
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {"code": "VALIDATION_ERROR", "message": message},
            "statusCode": 422,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {"code": "INTERNAL_ERROR", "message": "Внутренняя ошибка сервера"},
            "statusCode": 500,
        },
    )


app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(staff.router)
app.include_router(settings_router.router)
app.include_router(notifications.router)
app.include_router(admin_router.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
