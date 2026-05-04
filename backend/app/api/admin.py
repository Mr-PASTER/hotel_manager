"""
Admin routes:
  GET  /api/admin/db/export          → скачать дамп БД (PostgreSQL pg_dump / SQLite файл)
  POST /api/admin/db/import          → загрузить дамп БД
  GET  /api/admin/calendar/export    → скачать бронирования в Excel
"""
import io
import os
import subprocess
import tempfile
from datetime import date

from app.api.deps import get_db, require_admin
from app.core.config import settings
from app.models.booking import Booking
from app.models.room import Room
from app.models.user import User
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── helpers ──────────────────────────────────────────────────────────────────

def _parse_db_url(url: str) -> dict:
    """Parse DATABASE_URL into connection components."""
    # Expected formats:
    #   postgresql+asyncpg://user:pass@host:port/dbname
    #   sqlite+aiosqlite:///path/to/db.sqlite3
    if url.startswith("postgresql"):
        # Strip driver prefix
        raw = url.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
        userpass, rest = raw.split("@", 1)
        user, password = userpass.split(":", 1)
        hostport, dbname = rest.split("/", 1)
        if ":" in hostport:
            host, port = hostport.split(":", 1)
        else:
            host, port = hostport, "5432"
        return {"type": "postgresql", "user": user, "password": password,
                "host": host, "port": port, "dbname": dbname}
    elif url.startswith("sqlite"):
        path = url.split("///", 1)[1]
        return {"type": "sqlite", "path": path}
    else:
        raise ValueError(f"Unsupported DATABASE_URL scheme: {url}")


# ─── DB Export ────────────────────────────────────────────────────────────────

@router.get("/db/export")
async def export_database(
    _: User = Depends(require_admin),
):
    """Download a full database dump."""
    db_info = _parse_db_url(settings.DATABASE_URL)

    if db_info["type"] == "sqlite":
        path = db_info["path"]
        if not os.path.exists(path):
            raise HTTPException(404, detail={"code": "DB_NOT_FOUND", "message": "Файл БД не найден"})
        with open(path, "rb") as f:
            data = f.read()
        return Response(
            content=data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=hotel_manager.db"},
        )

    elif db_info["type"] == "postgresql":
        env = os.environ.copy()
        env["PGPASSWORD"] = db_info["password"]
        try:
            result = subprocess.run(
                [
                    "pg_dump",
                    "-h", db_info["host"],
                    "-p", db_info["port"],
                    "-U", db_info["user"],
                    "-d", db_info["dbname"],
                    "--no-password",
                    "--format=custom",
                ],
                env=env,
                capture_output=True,
                timeout=120,
            )
            if result.returncode != 0:
                raise HTTPException(
                    502,
                    detail={"code": "PG_DUMP_ERROR", "message": result.stderr.decode()},
                )
            return Response(
                content=result.stdout,
                media_type="application/octet-stream",
                headers={"Content-Disposition": "attachment; filename=hotel_manager.dump"},
            )
        except FileNotFoundError:
            raise HTTPException(
                500,
                detail={"code": "PG_DUMP_MISSING", "message": "pg_dump не установлен"},
            )


# ─── DB Import ────────────────────────────────────────────────────────────────

@router.post("/db/import")
async def import_database(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Upload and restore a database dump."""
    data = await file.read()
    db_info = _parse_db_url(settings.DATABASE_URL)

    if db_info["type"] == "sqlite":
        path = db_info["path"]
        # Write the uploaded file directly
        with open(path, "wb") as f:
            f.write(data)
        return {"ok": True, "message": "База данных успешно загружена. Перезапустите сервер для применения изменений."}

    elif db_info["type"] == "postgresql":
        env = os.environ.copy()
        env["PGPASSWORD"] = db_info["password"]
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dump") as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            # Drop and recreate schema first
            result = subprocess.run(
                [
                    "pg_restore",
                    "-h", db_info["host"],
                    "-p", db_info["port"],
                    "-U", db_info["user"],
                    "-d", db_info["dbname"],
                    "--no-password",
                    "--clean",
                    "--if-exists",
                    tmp_path,
                ],
                env=env,
                capture_output=True,
                timeout=120,
            )
            if result.returncode != 0:
                # pg_restore returns non-zero even for warnings; check stderr
                stderr = result.stderr.decode()
                if "error" in stderr.lower():
                    raise HTTPException(
                        502,
                        detail={"code": "PG_RESTORE_ERROR", "message": stderr},
                    )
            return {"ok": True, "message": "База данных успешно восстановлена."}
        except FileNotFoundError:
            raise HTTPException(
                500,
                detail={"code": "PG_RESTORE_MISSING", "message": "pg_restore не установлен"},
            )
        finally:
            os.unlink(tmp_path)


# ─── Calendar Excel Export ────────────────────────────────────────────────────

@router.get("/calendar/export")
async def export_calendar_excel(
    from_date: date = Query(None, alias="from"),
    to_date: date = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Export bookings calendar to Excel (.xlsx)."""
    try:
        import openpyxl
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise HTTPException(
            500,
            detail={"code": "OPENPYXL_MISSING", "message": "openpyxl не установлен на сервере"},
        )

    # Fetch bookings
    q = select(Booking).order_by(Booking.start_date)
    if from_date:
        q = q.where(Booking.end_date >= from_date)
    if to_date:
        q = q.where(Booking.start_date <= to_date)
    result = await db.execute(q)
    bookings = result.scalars().all()

    # Fetch rooms for name lookup
    rooms_res = await db.execute(select(Room).order_by(Room.number))
    rooms = {r.id: r for r in rooms_res.scalars().all()}

    # Build workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Бронирования"

    # ── Styles ──
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill("solid", fgColor="1E3A5F")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    center_align = Alignment(horizontal="center", vertical="center")

    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    alt_fill = PatternFill("solid", fgColor="F0F4F8")

    # ── Headers ──
    columns = [
        ("№ Номера", 12),
        ("Этаж", 8),
        ("Гость", 22),
        ("Телефон", 16),
        ("Дата заезда", 14),
        ("Дата выезда", 14),
        ("Ночей", 8),
        ("Примечания", 30),
        ("Создано", 18),
    ]

    for col_idx, (header, width) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[1].height = 28

    # ── Rows ──
    for row_idx, booking in enumerate(bookings, start=2):
        room = rooms.get(booking.room_id)
        nights = (booking.end_date - booking.start_date).days

        row_data = [
            room.number if room else "—",
            room.floor if room else "—",
            booking.guest_name,
            booking.phone or "",
            booking.start_date.strftime("%d.%m.%Y"),
            booking.end_date.strftime("%d.%m.%Y"),
            nights,
            booking.notes or "",
            booking.created_at.strftime("%d.%m.%Y %H:%M") if booking.created_at else "",
        ]

        fill = alt_fill if row_idx % 2 == 0 else None

        for col_idx, value in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = border
            if fill:
                cell.fill = fill
            if col_idx in (1, 5, 6, 7):
                cell.alignment = center_align
            else:
                cell.alignment = cell_align

        ws.row_dimensions[row_idx].height = 20

    # ── Summary row ──
    summary_row = len(bookings) + 2
    ws.cell(row=summary_row, column=1, value=f"Всего бронирований: {len(bookings)}")
    ws.cell(row=summary_row, column=1).font = Font(bold=True, italic=True, color="555555")

    # Freeze header row
    ws.freeze_panes = "A2"

    # ── Auto-filter ──
    ws.auto_filter.ref = f"A1:{get_column_letter(len(columns))}1"

    # Save to buffer
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = "calendar"
    if from_date:
        filename += f"_from_{from_date}"
    if to_date:
        filename += f"_to_{to_date}"
    filename += ".xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
