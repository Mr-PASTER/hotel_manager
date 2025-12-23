from fastapi import FastAPI, Request, Form, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from contextlib import asynccontextmanager

from .database import get_db, init_db, engine
from .models import Nomer, StatusNomera, User, Booking, BookingStatus
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

def format_booking_period_rus(start_date, end_date, time_start="14:00", time_end="12:00"):
    if not start_date or not end_date: return "—"
    try:
        months = {
            1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
            7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря"
        }
        dt_start = datetime.strptime(start_date, "%Y-%m-%d")
        dt_end = datetime.strptime(end_date, "%Y-%m-%d")
        
        start_str = f"{dt_start.day} {months[dt_start.month]} {dt_start.year} {time_start}"
        end_str = f"{dt_end.day} {months[dt_end.month]} {dt_end.year} {time_end}"
        
        return f"{start_str} — {end_str}"
    except Exception as e:
        return f"{start_date} - {end_date}"

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
    
    # Basic filters for status fields
    if filter == "clean":
        query = query.where(Nomer.status == StatusNomera.CHISTO)
    elif filter == "dirty":
        query = query.where(Nomer.status == StatusNomera.TREBUET_UBORKI)
    elif filter == "broken": # Assuming user meant "repair" for code but filter string was checked differently in previous attempts
        # The previous code had "broken" for REMONT, but also "repair" in my memory? 
        # Wait, the view says "elif filter == 'broken': query = query.where ... REMONT". 
        # User request said "red color for repair".
        query = query.where(Nomer.status == StatusNomera.REMONT)
    elif filter == "occupied": 
        query = query.where(Nomer.zanyat == True)
        
    result = await db.execute(query.order_by(Nomer.nomer_komnati))
    nomera = result.scalars().all()
    
    # --- Fetch upcoming bookings for dashboard display --- 
    # Current date
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Fetch all relevant bookings
    bookings_res = await db.execute(select(Booking).where(
        Booking.status != BookingStatus.CANCELLED,
        Booking.end_date >= today_str
    ).order_by(Booking.start_date))
    all_bookings = bookings_res.scalars().all()
    
    # Map to rooms
    room_bookings = {n.id: [] for n in nomera}
    for b in all_bookings:
        if b.nomer_id in room_bookings:
            room_bookings[b.nomer_id].append(b)
            
    # Attach data
    filtered_nomera = []
    
    for nomer in nomera:
        # Defaults for display
        nomer.zarezervirovan = False
        nomer.data_zaezda = None
        nomer.data_viezda = None
        
        bookings = room_bookings.get(nomer.id, [])
        if bookings:
            nearest_booking = None
            for b in bookings:
                if b.end_date >= today_str:
                    nearest_booking = b
                    break 
            
            if nearest_booking:
                nomer.zarezervirovan = True
                nomer.data_zaezda = nearest_booking.start_date
                nomer.data_viezda = nearest_booking.end_date
                nomer.vremya_zaezda = "14:00"
                nomer.vremya_viezda = "12:00"
                
                # Check if booking is active today
                # If active, room should be 'zanyat' (Occupied)
                if nearest_booking.start_date <= today_str <= nearest_booking.end_date:
                    nomer.zanyat = True
                    # nomer.gotov_k_sdache is a property, checks zanyat, so it will be False automatically
                    nomer.status = StatusNomera.ZANYATO if hasattr(StatusNomera, 'ZANYATO') else nomer.status
                    # Or just rely on zanyat=True which changes badge in nomer_row
                
                nomer.fio_bron = nearest_booking.guest_name
                nomer.telefon = nearest_booking.phone
                nomer.kommentariy = nearest_booking.comment
                nomer.dop_gosti = 0
                setattr(nomer, 'source', nearest_booking.source)
                setattr(nomer, 'contact_name', nearest_booking.guest_name)
        
        # Apply filters that depend on booking status (which we just calculated)
        if filter == "reserved":
            if nomer.zarezervirovan: filtered_nomera.append(nomer)
        elif filter == "occupied":
            if nomer.zanyat: filtered_nomera.append(nomer)
        elif filter == "ready":
             # Ready = Clean + Not Occupied + Not Reserved (Wait, if reserved but future, is it ready? Yes. But user logic might vary)
             # Let's keep strict "ready": Clean, Not Occupied.
             if nomer.gotov_k_sdache and not nomer.zanyat: filtered_nomera.append(nomer)
        else:
            filtered_nomera.append(nomer)
        

    
    nomera = filtered_nomera

    # Если это HTMX запрос на фильтрацию, возвращаем только список
    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("partials/nomer_list.html", {
            "request": request, 
            "nomera": nomera,
            "StatusNomera": StatusNomera,
            "user": user
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
    if user.role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    new_nomer = Nomer(
        nomer_komnati=nomer_komnati,
        kolvo_komnat=kolvo_komnat,
        kolvo_krovatey=kolvo_krovatey
    )
    db.add(new_nomer)
    await db.commit()
    await db.refresh(user)
    
    result = await db.execute(select(Nomer).order_by(Nomer.nomer_komnati))
    nomera = result.scalars().all()
    return templates.TemplateResponse("partials/nomer_list.html", {
        "request": request, 
        "nomera": nomera,
        "StatusNomera": StatusNomera,
        "user": user
    })

@app.post("/nomera/{nomer_id}/update", response_class=HTMLResponse)
async def update_nomer(
    request: Request,
    nomer_id: int,
    status: StatusNomera = Form(None),
    source: str = Form(None),
    otvetstvenniy: str = Form(None),
    zanyat: str = Form(None),
    fio_zhilca: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    result = await db.execute(select(Nomer).where(Nomer.id == nomer_id))
    nomer = result.scalar_one_or_none()
    
    # Сохраняем текущие данные брони ПЕРЕД изменениями
    today_str = datetime.now().strftime("%Y-%m-%d")
    bookings_res = await db.execute(select(Booking).where(
        Booking.nomer_id == nomer_id,
        Booking.status != BookingStatus.CANCELLED,
        Booking.end_date >= today_str
    ).order_by(Booking.start_date))
    current_booking = bookings_res.scalars().first()
    
    if status: 
        nomer.status = status
        # При смене статуса сбрасываем назначенного сотрудника, как просил пользователь
        if status in [StatusNomera.CHISTO, StatusNomera.REMONT, StatusNomera.TREBUET_UBORKI]:
            nomer.otvetstvenniy = None
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
    
    # Сохраняем данные брони ДО commit (чтобы избежать MissingGreenlet)
    booking_data = None
    if current_booking:
        booking_data = {
            'start_date': current_booking.start_date,
            'end_date': current_booking.end_date,
            'guest_name': current_booking.guest_name,
            'phone': current_booking.phone,
            'comment': current_booking.comment,
            'source': current_booking.source
        }
    
    await db.commit()
    await db.refresh(nomer)
    await db.refresh(user)
    
    # Восстанавливаем данные брони для отображения (они НЕ хранятся в Nomer, только в Booking)
    if booking_data:
        nomer.zarezervirovan = True
        nomer.data_zaezda = booking_data['start_date']
        nomer.data_viezda = booking_data['end_date']
        nomer.vremya_zaezda = "14:00"
        nomer.vremya_viezda = "12:00"
        nomer.fio_bron = booking_data['guest_name']
        nomer.telefon = booking_data['phone']
        nomer.kommentariy = booking_data['comment']
        setattr(nomer, 'source', booking_data['source'])
        
        # Проверяем активность брони
        if booking_data['start_date'] <= today_str <= booking_data['end_date']:
            nomer.zanyat = True
    
    return templates.TemplateResponse("partials/nomer_row.html", {
        "request": request, 
        "nomer": nomer,
        "StatusNomera": StatusNomera,
        "user": user
    })

@app.get("/nomera/{nomer_id}/details", response_class=HTMLResponse)
async def get_nomer_details(
    request: Request,
    nomer_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    nomer = await db.get(Nomer, nomer_id)
    
    # Fetch active booking to populate details
    today_str = datetime.now().strftime("%Y-%m-%d")
    bookings_res = await db.execute(select(Booking).where(
        Booking.nomer_id == nomer_id,
        Booking.status != BookingStatus.CANCELLED,
        Booking.end_date >= today_str
    ).order_by(Booking.start_date))
    booking = bookings_res.scalars().first()
    
    if booking:
        nomer.fio_zhilca = booking.guest_name
        nomer.data_zaezda = booking.start_date
        nomer.data_viezda = booking.end_date
        
    return templates.TemplateResponse("partials/room_details.html", {
        "request": request,
        "nomer": nomer,
        "StatusNomera": StatusNomera
    })

@app.get("/nomera/{nomer_id}/booking-modal", response_class=HTMLResponse)
async def get_booking_modal(
    request: Request, 
    nomer_id: int, 
    start: str = None,
    end: str = None,
    source_page: str = None,
    db: AsyncSession = Depends(get_db), 
    user: User = Depends(login_required)
):
    nomer = await db.get(Nomer, nomer_id)
    return templates.TemplateResponse("partials/booking_modal.html", {
        "request": request, 
        "nomer": nomer,
        "start_date": start,
        "end_date": end,
        "source_page": source_page
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
    source: str = Form(None),
    source_page: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    nomer = await db.get(Nomer, nomer_id)
    if not nomer:
        raise HTTPException(status_code=404, detail="Nomer not found")

    # Создаем новую бронь
    new_booking = Booking(
        nomer_id=nomer_id,
        start_date=data_zaezda,
        end_date=data_viezda,
        guest_name=fio_bron,
        phone=telefon,
        source=source,
        comment=kommentariy,
        status=BookingStatus.BOOKED
    )
    db.add(new_booking)
    
    # Обновляем статус номера, если бронь начинается сегодня (опционально, но логично)
    # Или оставляем как есть, так как запрос был разделить понятия.
    # Но для отображения в списке комнат нужно хотя бы знать что она занята/забронирована?
    # Пока оставим только запись в Booking. НО для совместимости с nomer_row, 
    # если хотим чтобы там отображалась "Забронирован", нужно либо менять логику nomer_row
    # либо дублировать данные. 
    # Пользователь просил "различать бронь от заселения".
    # Сейчас мы просто создаем бронь. Заселение (CheckIn) - отдельный процесс.
    
    await db.commit()
    await db.refresh(nomer)
    await db.refresh(user)

    if source_page == 'calendar':
        return HTMLResponse("<script>window.location.reload();</script>")
    await db.commit()
    await db.refresh(nomer)
    await db.refresh(user)
    
    # If request came from details modal, we need to return updated modal content AND update the row in background
    if source == 'details':
        # Fetch active booking to populate details for the modal
        today_str = datetime.now().strftime("%Y-%m-%d")
        bookings_res = await db.execute(select(Booking).where(
            Booking.nomer_id == nomer_id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.end_date >= today_str
        ).order_by(Booking.start_date))
        booking = bookings_res.scalars().first()
        
        if booking:
            nomer.fio_zhilca = booking.guest_name
            nomer.data_zaezda = booking.start_date
            nomer.data_viezda = booking.end_date
            
        # 1. Render modal content
        modal_content = templates.get_template("partials/room_details.html").render({
            "request": request,
            "nomer": nomer,
            "StatusNomera": StatusNomera
        })
        
        # 2. Render row content for OOB swap
        row_content = templates.get_template("partials/nomer_row.html").render({
            "request": request,
            "nomer": nomer,
            "StatusNomera": StatusNomera,
            "user": user
        })
        
        # We need to wrap row_content with hx-swap-oob="true" or specific ID targeting if it doesn't have it (it has ID on tr)
        # But nomer_row.html is a TR with id="nomer-{{id}}". To OOB swap it, we add hx-swap-oob="true" to the tag?
        # Or we can wrap it in a div with hx-swap-oob. But TR cannot be inside DIV in tbody.
        # Htmx supports hx-swap-oob="outerHTML:#id".
        # Let's inject hx-swap-oob attribute into the rendered string.
        row_content_oob = row_content.replace(f'<tr id="nomer-{nomer.id}">', f'<tr id="nomer-{nomer.id}" hx-swap-oob="true">', 1)
        
        return HTMLResponse(content=modal_content + row_content_oob)

    return templates.TemplateResponse("partials/nomer_row.html", {
        "request": request, 
        "nomer": nomer,
        "StatusNomera": StatusNomera,
        "user": user
    })

@app.get("/nomera/{nomer_id}/guest-details", response_class=HTMLResponse)
async def guest_details(request: Request, nomer_id: int, back: bool = False, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    result = await db.execute(select(Nomer).where(Nomer.id == nomer_id))
    nomer = result.scalar_one_or_none()
    
    # Fetch active booking to show details
    today_str = datetime.now().strftime("%Y-%m-%d")
    bookings_res = await db.execute(select(Booking).where(
        Booking.nomer_id == nomer_id,
        Booking.status != BookingStatus.CANCELLED,
        Booking.end_date >= today_str
    ).order_by(Booking.start_date))
    booking = bookings_res.scalars().first()
    
    if booking:
        nomer.fio_zhilca = booking.guest_name # Use booking name as resident name for display
        nomer.telefon = booking.phone
        nomer.kommentariy = booking.comment
        nomer.dop_gosti = 0 
        
        setattr(nomer, 'source', booking.source)
        
        # Format booking period for display
        booking_period = format_booking_period_rus(booking.start_date, booking.end_date)
        setattr(nomer, 'booking_period', booking_period)
        setattr(nomer, 'has_booking', True) # Flag to show delete button
    else:
        setattr(nomer, 'booking_period', "Нет активной брони")
        setattr(nomer, 'has_booking', False)
        
    return templates.TemplateResponse("partials/guest_details.html", {
        "request": request, 
        "nomer": nomer,
        "show_back": back
    })

@app.post("/nomera/{nomer_id}/cancel-reserv", response_class=HTMLResponse)
async def cancel_reserve(request: Request, nomer_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    if user.role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Update Booking status
    today_str = datetime.now().strftime("%Y-%m-%d")
    bookings_res = await db.execute(select(Booking).where(
        Booking.nomer_id == nomer_id,
        Booking.status != BookingStatus.CANCELLED,
        Booking.end_date >= today_str
    ).order_by(Booking.start_date))
    booking = bookings_res.scalars().first()
    
    if booking:
        booking.status = BookingStatus.CANCELLED
        
    # Also clear Nomer transient fields if any (just in case they were set in DB, though we stopped that)
    # But for safety, we re-fetch to return row
    
    result = await db.execute(select(Nomer).where(Nomer.id == nomer_id))
    nomer = result.scalar_one_or_none()
    
    # We don't need to manually clear nomer fields because they are transient and calculated from Booking table.
    # But if database still has old 'zarezervirovan' flags, we might want to clear them to be safe.
    nomer.zarezervirovan = False
    nomer.zanyat = False 
    
    await db.commit()
    await db.refresh(nomer)
    await db.refresh(user)
    
    # If request came from calendar modal (guest-details-modal), reload page to refresh calendar
    hx_target = request.headers.get("HX-Target")
    referer = request.headers.get("referer", "")
    
    if hx_target == "guest-details-modal" or hx_target == "closest .modal-overlay" or "calendar" in referer:
         return HTMLResponse("<script>window.location.reload();</script>")

    return templates.TemplateResponse("partials/nomer_row.html", {
        "request": request, 
        "nomer": nomer, 
        "StatusNomera": StatusNomera,
        "user": user
    })

@app.delete("/nomera/{nomer_id}", response_class=HTMLResponse)
async def delete_nomer(nomer_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(login_required)):
    if user.role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.execute(delete(Nomer).where(Nomer.id == nomer_id))
    await db.commit()
    return HTMLResponse(content="")

# --- Управление персоналом ---

@app.get("/staff", response_class=HTMLResponse)
async def staff_list(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role != "admin":
        return RedirectResponse(url="/", status_code=303)
    
    result = await db.execute(select(User).order_by(User.id))
    staff = result.scalars().all()
    return templates.TemplateResponse("staff_management.html", {
        "request": request,
        "staff": staff,
        "user": user
    })

@app.post("/staff", response_class=HTMLResponse)
async def add_staff(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    role: str = Form("staff"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role != "admin":
        raise HTTPException(status_code=403)
    
    new_user = User(
        username=username,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return templates.TemplateResponse("partials/staff_row.html", {
        "request": request,
        "s": new_user
    })

@app.delete("/staff/{user_id}", response_class=HTMLResponse)
async def delete_staff(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role != "admin":
        raise HTTPException(status_code=403)
    
    if user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return HTMLResponse(content="")

@app.get("/staff/{user_id}/details", response_class=HTMLResponse)
async def staff_details_modal(
    request: Request,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role != "admin":
        raise HTTPException(status_code=403)
    
    target_user = await db.get(User, user_id)
    return templates.TemplateResponse("partials/staff_details_modal.html", {
        "request": request,
        "s": target_user
    })

@app.post("/staff/{user_id}/update", response_class=HTMLResponse)
async def update_staff(
    request: Request,
    user_id: int,
    username: str = Form(None),
    password: str = Form(None),
    full_name: str = Form(None),
    role: str = Form(None),
    phone: str = Form(None),
    telegram_id: str = Form(None),
    comment: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role != "admin":
        raise HTTPException(status_code=403)
    
    target_user = await db.get(User, user_id)
    if username: target_user.username = username
    if password: target_user.hashed_password = get_password_hash(password)
    if full_name: target_user.full_name = full_name
    if role: target_user.role = role
    if phone is not None: target_user.phone = phone
    if telegram_id is not None: target_user.telegram_id = telegram_id
    if comment is not None: target_user.comment = comment
    
    await db.commit()
    await db.refresh(target_user)
    
    return templates.TemplateResponse("partials/staff_row.html", {
        "request": request,
        "s": target_user
    })

# --- Календарь занятости ---

@app.get("/calendar", response_class=HTMLResponse)
async def occupancy_calendar(
    request: Request,
    month: int = None,
    year: int = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    if user.role != "admin":
        return RedirectResponse(url="/", status_code=303)
    
    now = datetime.now()
    if not month: month = now.month
    if not year: year = now.year
    
    # Определяем первый и последний день месяца
    import calendar as py_calendar
    first_day = datetime(year, month, 1).date()
    last_day_num = py_calendar.monthrange(year, month)[1]
    last_day = datetime(year, month, last_day_num).date()
    
    days = [first_day + timedelta(days=i) for i in range(last_day_num)]
    
    result = await db.execute(select(Nomer).order_by(Nomer.nomer_komnati))
    nomera = result.scalars().all()
    
    # Fetch all bookings for this month range
    # Creating a simplified range check: Start <= EndOfMonth AND End >= StartOfMonth
    # Dates are strings in DB "YYYY-MM-DD"
    
    month_start_str = first_day.strftime("%Y-%m-%d")
    month_end_str = last_day.strftime("%Y-%m-%d")
    
    # Simple query: get all bookings that might overlap.
    # Note: proper implementation would filter in SQL. 
    # For now, fetching active bookings and filtering in python for simplicity if dataset is small, 
    # or using string comparison which works for ISO dates.
    
    bookings_result = await db.execute(select(Booking).where(
        Booking.status != BookingStatus.CANCELLED,
        Booking.end_date >= month_start_str,
        Booking.start_date <= month_end_str
    ))
    all_bookings = bookings_result.scalars().all()
    
    # Map bookings to rooms
    room_bookings = {n.id: [] for n in nomera}
    for b in all_bookings:
        if b.nomer_id in room_bookings:
            room_bookings[b.nomer_id].append(b)
    
    calendar_data = []
    for nomer in nomera:
        days_status = []
        nomer_bookings = room_bookings.get(nomer.id, [])
        
        for day in days:
            day_str = day.strftime("%Y-%m-%d")
            status_code = 0 # 0 - free, 1 - booked, 2 - occupied (checked_in)
            
            for b in nomer_bookings:
                if b.start_date <= day_str <= b.end_date:
                    if b.status == BookingStatus.CHECKED_IN:
                        status_code = 2
                    else:
                        status_code = 1
                    break
            
            days_status.append(status_code)
            
        calendar_data.append({
            "nomer": nomer,
            "days": days_status
        })
        
    months_names = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", 
                    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
        
    return templates.TemplateResponse("calendar.html", {
        "request": request,
        "days": days,
        "calendar_data": calendar_data,
        "user": user,
        "current_month": month,
        "current_year": year,
        "months_names": months_names,
        "now_date": now.strftime("%Y-%m-%d")
    })

@app.get("/nomera/{nomer_id}/assign-staff-modal", response_class=HTMLResponse)
async def assign_staff_modal(
    request: Request,
    nomer_id: int,
    source: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(login_required)
):
    nomer = await db.get(Nomer, nomer_id)
    
    # Определяем нужную роль в зависимости от статуса номера
    target_role = "cleaner" if nomer.status == StatusNomera.TREBUET_UBORKI else "worker"
    
    result = await db.execute(select(User).where(User.role == target_role))
    available_staff = result.scalars().all()
    
    return templates.TemplateResponse("partials/assign_staff_modal.html", {
        "request": request,
        "nomer": nomer,
        "staff": available_staff,
        "target_role": "Уборка" if target_role == "cleaner" else "Ремонт",
        "source": source
    })


