import asyncio
import os
import models
from database import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    assignments,
    auth,
    bookings,
    calendar,
    employees,
    guests,
    rooms,
    settings,
)
from contextlib import asynccontextmanager
from telegram_bot import start_bot
from scheduler import scheduler_loop

# Ссылка на frontend (задаётся через env на Render)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

# Create all tables
models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запускаем поллинг бота и планировщик в фоне при старте приложения
    bot_task = asyncio.create_task(start_bot())
    scheduler_task = asyncio.create_task(scheduler_loop())
    yield
    bot_task.cancel()
    scheduler_task.cancel()


app = FastAPI(title="Hotel Manager API", lifespan=lifespan, version="1.0.0")


# CORS — разрешаем локальную разработку + GitHub Pages + Docker Server
_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://193.169.11.185:5174",
    "http://193.169.11.185:5173",
    "http://193.169.11.185", # Адрес сервера в проде (Docker)
]
if FRONTEND_URL:
    _allowed_origins.append(FRONTEND_URL)
    # Добавляем вариант без трейлингого слэша
    _allowed_origins.append(FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-New-Token"],
)

# Include routers
app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(employees.router)
app.include_router(guests.router)
app.include_router(bookings.router)
app.include_router(assignments.router)
app.include_router(calendar.router)
app.include_router(settings.router)


@app.get("/")
def root():
    return {"message": "Hotel Manager API is running"}
