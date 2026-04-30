import asyncio
import os
import models
from database import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    auth,
    bookings,
    calendar,
    employees,
    guests,
    rooms,
    settings,
)
from contextlib import asynccontextmanager

# Ссылка на frontend (задаётся через env)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

# Создаём все таблицы при старте
models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # Telegram/MAX отключены — ничего не запускаем в фоне


app = FastAPI(title="Hotel Manager API", lifespan=lifespan, version="2.0.0")

# CORS
_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:80",
    "http://localhost",
    "http://193.169.11.185",
    "https://hotel.mpda.ru",
    "http://hotel.mpda.ru",
]
if FRONTEND_URL:
    _allowed_origins.append(FRONTEND_URL)
    _allowed_origins.append(FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-New-Token"],
)

app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(employees.router)
app.include_router(guests.router)
app.include_router(bookings.router)
app.include_router(calendar.router)
app.include_router(settings.router)


@app.get("/")
def root():
    return {"message": "Hotel Manager API v2 running"}
