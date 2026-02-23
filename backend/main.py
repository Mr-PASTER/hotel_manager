import asyncio
import os
import models
from database import engine
from fastapi import FastAPI, Request
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
from routers.auth import create_access_token
from contextlib import asynccontextmanager
from telegram_bot import start_bot

# Ссылка на frontend (задаётся через env на Render)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

# Create all tables
models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запускаем поллинг бота в фоне при старте приложения
    bot_task = asyncio.create_task(start_bot())
    yield
    bot_task.cancel()


app = FastAPI(title="Hotel Manager API", lifespan=lifespan, version="1.0.0")


# Token Rotation Middleware
@app.middleware("http")
async def rotate_token_middleware(request: Request, call_next):
    # Call the next function to process the request
    response = await call_next(request)

    # If the user was authenticated, generate a new token
    # Use user_data dict instead of SQLAlchemy object to avoid DetachedInstanceError
    if hasattr(request.state, "user_data") and request.state.user_data:
        user_data = request.state.user_data
        new_token = create_access_token(
            data={
                "sub": user_data["username"],
                "role": user_data["role"],
                "id": user_data["id"],
            }
        )
        # Set in Header (for visibility/existing clients)
        response.headers["X-New-Token"] = new_token

        # Set in Cookie (for automatic browser handling)
        response.set_cookie(
            key="access_token",
            value=new_token,
            httponly=True,
            max_age=3600,  # 1 hour
            # samesite=none + secure обязательны при разных доменах (GitHub Pages + Render)
            samesite="none",
            secure=True,
            path="/",
        )

    return response


# CORS — разрешаем локальную разработку + GitHub Pages
_allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
