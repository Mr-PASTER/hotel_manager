from fastapi import FastAPI, Request, Form, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from contextlib import asynccontextmanager

from .database import get_db, init_db, engine
from .models import Nomer, StatusNomera, User
from .auth import verify_password, create_access_token, get_password_hash, ALGORITHM, SECRET_KEY, failed_login_attempts
from jose import jwt
from datetime import datetime, timedelta
from fastapi.responses import HTMLResponse, RedirectResponse

async def lifespan(app: FastAPI):
    # Инициализация БД
    await init_db()
    
    # Создание начального админа, если его нет
    async with engine.begin() as conn:
        from .database import SessionLocal
        async with SessionLocal() as db:
            result = await db.execute(select(User).where(User.username == "admin"))
            if not result.scalar_one_or_none():
                admin = User(
                    username="admin", 
                    hashed_password=get_password_hash("admin"),
                    full_name="Администратор",
                    role="admin"
                )
                db.add(admin)
                await db.commit()
    yield

app = FastAPI(lifespan=lifespan)

# Подключение шаблонов и статики
templates = Jinja2Templates(directory="app/templates")

def format_date_rus(date_str):
    if not date_str: return "—"
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        day_of_week = days[dt.weekday()]
        return f"{dt.strftime('%d.%m.%Y')} ({day_of_week})"
    except:
        return date_str

templates.env.globals["format_date"] = format_date_rus

app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/.well-known/appspecific/com.chrome.devtools.json")
async def chrome_devtools_json():
    return {"status": "ok"}

# Зависимость для получения текущего пользователя
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        return user
    except Exception:
        return None

def login_required(user: User = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=302, headers={"Location": "/login"})
    return user

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...), db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host
    now = datetime.now()
    
    # Проверка блокировки
    if client_ip in failed_login_attempts:
        if failed_login_attempts[client_ip]["block_until"] > now:
            remaining = int((failed_login_attempts[client_ip]["block_until"] - now).total_seconds())
            return templates.TemplateResponse("login.html", {
                "request": request, 
                "error": f"Слишком много попыток. Подождите {remaining} сек."
            })
            
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(password, user.hashed_password):
        # Логика счетчика попыток
        if client_ip not in failed_login_attempts:
            failed_login_attempts[client_ip] = {"attempts": 1, "block_until": now}
        else:
            failed_login_attempts[client_ip]["attempts"] += 1
            
        if failed_login_attempts[client_ip]["attempts"] >= 5:
            failed_login_attempts[client_ip]["block_until"] = now + timedelta(minutes=10)
            return templates.TemplateResponse("login.html", {
                "request": request, 
                "error": "Аккаунт заблокирован на 10 минут из-за перебора паролей."
            })
            
        return templates.TemplateResponse("login.html", {
            "request": request, 
            "error": "Неверный логин или пароль"
        })
    
    # Сброс счетчика при успехе
    if client_ip in failed_login_attempts:
        del failed_login_attempts[client_ip]
        
    access_token = create_access_token(data={"sub": user.username})
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(key="access_token", value=access_token, httponly=True)
    return response

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    return response

@app.get("/", response_class=HTMLResponse)
async def dashboard(
    request: Request, 
    filter: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    query = select(Nomer)
    
    if filter == "ready":
        # Готовы к сдаче: Чисто, Не занят, Не забронирован
        query = query.where(Nomer.status == StatusNomera.CHISTO, Nomer.zanyat == False, Nomer.zarezervirovan == False)
    elif filter == "reserved":
        query = query.where(Nomer.zarezervirovan == True)
    elif filter == "dirty":
        query = query.where(Nomer.status == StatusNomera.TREBUET_UBORKI)
    elif filter == "broken":
        query = query.where(Nomer.status == StatusNomera.REMONT)
    elif filter == "occupied":
        query = query.where(Nomer.zanyat == True)
        
    result = await db.execute(query.order_by(Nomer.nomer_komnati))
    nomera = result.scalars().all()
    
    # Если это HTMX запрос на фильтрацию, возвращаем только список
    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/nomer_list.html", {
            "request": request, 
            "nomera": nomera,
            "StatusNomera": StatusNomera
        })

    return templates.TemplateResponse("index.html", {
        "request": request, 
        "nomera": nomera,
        "StatusNomera": StatusNomera,
        "current_filter": filter,
        "user": user
    })

@app.post("/nomera", response_class=HTMLResponse)
async def create_nomer(
    request: Request, 
    nomer_komnati: str = Form(...),
    kolvo_komnat: int = Form(1),
    kolvo_krovatey: int = Form(1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    new_nomer = Nomer(
        nomer_komnati=nomer_komnati,
        kolvo_komnat=kolvo_komnat,
        kolvo_krovatey=kolvo_krovatey
    )
    db.add(new_nomer)
    await db.commit()
    
    result = await db.execute(select(Nomer).order_by(Nomer.nomer_komnati))
    nomera = result.scalars().all()
    return templates.TemplateResponse("partials/nomer_list.html", {
        "request": request, 
        "nomera": nomera,
        "StatusNomera": StatusNomera
    })

@app.post("/nomera/{nomer_id}/update", response_class=HTMLResponse)
async def update_nomer(
    request: Request,
    nomer_id: int,
    status: StatusNomera = Form(None),
    otvetstvenniy: str = Form(None),
    zanyat: str = Form(None),
    fio_zhilca: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    result = await db.execute(select(Nomer).where(Nomer.id == nomer_id))
    nomer = result.scalar_one_or_none()
    
    if status: nomer.status = status
    if otvetstvenniy is not None: nomer.otvetstvenniy = otvetstvenniy
    
    if zanyat is not None:
        nomer.zanyat = (zanyat.lower() == "true")
        if not nomer.zanyat:
            # Если выселяем, очищаем данные жильца
            nomer.fio_zhilca = None
            nomer.telefon = None
            nomer.zarezervirovan = False
            nomer.data_zaezda = None
            nomer.data_viezda = None
            nomer.vremya_zaezda = "14:00"
            nomer.vremya_viezda = "12:00"

    if fio_zhilca is not None: nomer.fio_zhilca = fio_zhilca
    
    await db.commit()
    await db.refresh(nomer)
    return templates.TemplateResponse("partials/nomer_row.html", {
        "request": request, 
        "nomer": nomer,
        "StatusNomera": StatusNomera
    })

@app.get("/nomera/{nomer_id}/details", response_class=HTMLResponse)
async def get_nomer_details(
    request: Request,
    nomer_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    nomer = await db.get(Nomer, nomer_id)
    return templates.TemplateResponse("partials/room_details.html", {
        "request": request,
        "nomer": nomer,
        "StatusNomera": StatusNomera
    })

@app.get("/nomera/{nomer_id}/booking-modal", response_class=HTMLResponse)
async def get_booking_modal(request: Request, nomer_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    nomer = await db.get(Nomer, nomer_id)
    return templates.TemplateResponse("partials/booking_modal.html", {
        "request": request, 
        "nomer": nomer
    })

@app.post("/nomera/{nomer_id}/reserv", response_class=HTMLResponse)
async def reserve_nomer(
    request: Request,
    nomer_id: int,
    data_zaezda: str = Form(...),
    data_viezda: str = Form(...),
    vremya_zaezda: str = Form(...),
    vremya_viezda: str = Form(...),
    fio_bron: str = Form(...),
    telefon: str = Form(...),
    dop_gosti: int = Form(0),
    kommentariy: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    nomer = await db.get(Nomer, nomer_id)
    if not nomer:
        raise HTTPException(status_code=404, detail="Nomer not found")

    # Основные данные брони
    nomer.zarezervirovan = True
    nomer.data_zaezda = data_zaezda
    nomer.data_viezda = data_viezda
    nomer.vremya_zaezda = vremya_zaezda
    nomer.vremya_viezda = vremya_viezda
    nomer.fio_bron = fio_bron
    nomer.telefon = telefon
    nomer.dop_gosti = dop_gosti
    nomer.kommentariy = kommentariy
    
    # Сразу заселяем (как просил пользователь в логике работы)
    nomer.zanyat = True
    nomer.fio_zhilca = fio_bron
    
    await db.commit()
    await db.refresh(nomer)
    
    return templates.TemplateResponse("partials/nomer_row.html", {
        "request": request, 
        "nomer": nomer,
        "StatusNomera": StatusNomera
    })

@app.get("/nomera/{nomer_id}/guest-details", response_class=HTMLResponse)
async def guest_details(request: Request, nomer_id: int, back: bool = False, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    result = await db.execute(select(Nomer).where(Nomer.id == nomer_id))
    nomer = result.scalar_one_or_none()
    return templates.TemplateResponse("partials/guest_details.html", {
        "request": request, 
        "nomer": nomer,
        "show_back": back
    })

@app.post("/nomera/{nomer_id}/cancel-reserv", response_class=HTMLResponse)
async def cancel_reserve(request: Request, nomer_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    result = await db.execute(select(Nomer).where(Nomer.id == nomer_id))
    nomer = result.scalar_one_or_none()
    
    # Полная очистка при отмене брони (выселение)
    nomer.zarezervirovan = False
    nomer.zanyat = False
    nomer.fio_zhilca = None
    nomer.fio_bron = None
    nomer.telefon = None
    nomer.data_zaezda = None
    nomer.data_viezda = None
    nomer.vremya_zaezda = None
    nomer.vremya_viezda = None
    nomer.kommentariy = None
    nomer.dop_gosti = 0
    
    await db.commit()
    await db.refresh(nomer)
    return templates.TemplateResponse("partials/nomer_row.html", {"request": request, "nomer": nomer, "StatusNomera": StatusNomera})

@app.delete("/nomera/{nomer_id}", response_class=HTMLResponse)
async def delete_nomer(nomer_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    await db.execute(delete(Nomer).where(Nomer.id == nomer_id))
    await db.commit()
    return HTMLResponse(content="")
