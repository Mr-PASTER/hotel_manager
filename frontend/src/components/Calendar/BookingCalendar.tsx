import { useState, useEffect } from "react";
import {
    ChevronLeft,
    ChevronRight,
    X,
    Phone,
    FileText,
    CalendarDays,
} from "lucide-react";
import {
    format,
    addDays,
    isSameDay,
    parseISO,
    startOfDay,
    differenceInDays,
    isAfter,
} from "date-fns";
import { ru } from "date-fns/locale";
import toast from "react-hot-toast";
import { useRoomStore } from "../../store/roomStore";
import { useBookingStore } from "../../store/bookingStore";
import type { Booking, Room } from "../../types";

// ─── constants ────────────────────────────────────────────────────────────────

const CELL_W = 56; // px  (Tailwind w-14)
const CELL_H = 56; // px  (Tailwind h-14)
const DAYS_COUNT = 30;
const ROOM_COL_W = 96; // px  (Tailwind w-24)

// Russian abbreviated day names, index = getDay() (0 = Sun)
const DAY_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Parse 'YYYY-MM-DD' as local midnight — avoids UTC/DST offset issues */
function localDate(str: string): Date {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/** Format a local midnight Date back to 'YYYY-MM-DD' string */
function toDateStr(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Selection {
    roomId: string;
    startDate: Date;
}

interface PendingRange {
    roomId: string;
    start: Date;
    end: Date;
}

interface BookingFormData {
    guestName: string;
    phone: string;
    notes: string;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function BookingCalendar() {
    const { rooms, fetchRooms } = useRoomStore();
    const { bookings, addBooking, removeBooking, hasConflict, fetchBookings } =
        useBookingStore();

    const [viewStart, setViewStart] = useState<Date>(() =>
        startOfDay(new Date()),
    );
    const [selection, setSelection] = useState<Selection | null>(null);
    const [pendingRange, setPendingRange] = useState<PendingRange | null>(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingForm, setBookingForm] = useState<BookingFormData>({
        guestName: "",
        phone: "",
        notes: "",
    });
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Derived: array of 30 days
    const days = Array.from({ length: DAYS_COUNT }, (_, i) =>
        addDays(viewStart, i),
    );
    const today = startOfDay(new Date());

    // ── Escape key ─────────────────────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelection(null);
                setActiveBooking(null);
                setDeleteConfirm(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        fetchRooms();
        fetchBookings();
    }, [fetchRooms, fetchBookings]);

    // ── Cell click ──────────────────────────────────────────────────────────────

    const handleCellClick = (room: Room, day: Date) => {
        const dayStr = toDateStr(day);
        const isBooked = bookings.some(
            (b) =>
                b.roomId === room.id &&
                b.startDate <= dayStr &&
                b.endDate >= dayStr,
        );
        if (isBooked) return;

        if (!selection) {
            setSelection({ roomId: room.id, startDate: day });
            return;
        }

        if (selection.roomId !== room.id) {
            setSelection({ roomId: room.id, startDate: day });
            toast("Выберите конечную дату в той же строке", { icon: "ℹ️" });
            return;
        }

        if (isSameDay(selection.startDate, day)) {
            setSelection(null);
            return;
        }

        // Build range (sort so start <= end)
        let start = selection.startDate;
        let end = day;
        if (isAfter(start, end)) [start, end] = [end, start];

        const startStr = toDateStr(start);
        const endStr = toDateStr(end);

        if (hasConflict(room.id, startStr, endStr)) {
            toast.error("Номер уже забронирован на выбранный период");
            setSelection(null);
            return;
        }

        setPendingRange({ roomId: room.id, start, end });
        setBookingForm({ guestName: "", phone: "", notes: "" });
        setShowBookingModal(true);
        setSelection(null);
    };

    // ── Booking submit ──────────────────────────────────────────────────────────

    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingRange || !bookingForm.guestName.trim()) return;
        const result = await addBooking({
            roomId: pendingRange.roomId,
            guestName: bookingForm.guestName.trim(),
            phone: bookingForm.phone.trim() || undefined,
            notes: bookingForm.notes.trim() || undefined,
            startDate: toDateStr(pendingRange.start),
            endDate: toDateStr(pendingRange.end),
        });
        if (result.success) {
            toast.success("Бронирование добавлено");
            setShowBookingModal(false);
            setPendingRange(null);
        } else {
            toast.error(result.error ?? "Ошибка при создании бронирования");
        }
    };

    // ── Booking block click ─────────────────────────────────────────────────────

    const handleBookingClick = (booking: Booking, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveBooking(booking);
        setDeleteConfirm(false);
    };

    const handleDeleteBooking = async () => {
        if (!activeBooking) return;
        await removeBooking(activeBooking.id);
        setActiveBooking(null);
        setDeleteConfirm(false);
        toast.success("Бронирование удалено");
    };

    // ── Booking block geometry ──────────────────────────────────────────────────

    const getBookingBlock = (
        booking: Booking,
    ): { left: number; width: number } | null => {
        const vStartStr = toDateStr(days[0]);
        const vEndStr = toDateStr(days[days.length - 1]);

        if (booking.endDate < vStartStr || booking.startDate > vEndStr)
            return null;

        const clampedStart =
            booking.startDate < vStartStr ? vStartStr : booking.startDate;
        const clampedEnd =
            booking.endDate > vEndStr ? vEndStr : booking.endDate;

        const startIdx = differenceInDays(
            localDate(clampedStart),
            localDate(vStartStr),
        );
        const endIdx = differenceInDays(
            localDate(clampedEnd),
            localDate(vStartStr),
        );

        const left = startIdx * CELL_W + 3;
        const width = (endIdx - startIdx + 1) * CELL_W - 6;

        return { left, width };
    };

    // ── Render helpers ──────────────────────────────────────────────────────────

    const isToday = (d: Date) => isSameDay(d, today);
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

    const headerCellCls = (d: Date) =>
        [
            "shrink-0 flex flex-col items-center justify-center border-r border-b select-none",
            isToday(d)
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40"
                : isWeekend(d)
                  ? "bg-gray-50 dark:bg-slate-700/30 border-gray-200 dark:border-slate-700"
                  : "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700",
        ].join(" ");

    const dayCellCls = (room: Room, d: Date, dayStr: string) => {
        const booked = bookings.some(
            (b) =>
                b.roomId === room.id &&
                b.startDate <= dayStr &&
                b.endDate >= dayStr,
        );
        const selected =
            selection?.roomId === room.id && isSameDay(selection.startDate, d);
        return [
            "shrink-0 border-r border-b border-gray-100 dark:border-slate-700 transition-colors select-none",
            booked ? "cursor-default" : "cursor-pointer",
            selected
                ? "bg-sky-100 dark:bg-sky-900/40"
                : isToday(d)
                  ? "bg-amber-50/60 dark:bg-amber-900/20"
                  : isWeekend(d)
                    ? "bg-gray-50/50 dark:bg-slate-700/30"
                    : "bg-transparent",
            !booked && !selected
                ? "hover:bg-sky-50 dark:hover:bg-sky-900/20"
                : "",
        ].join(" ");
    };

    // ─────────────────────────────────────────────────────────────────────────────

    const pendingRoom = rooms.find((r) => r.id === pendingRange?.roomId);
    const activeRoom = rooms.find((r) => r.id === activeBooking?.roomId);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Toolbar ── */}
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <h1 className="text-base font-bold text-gray-900 dark:text-slate-100 mr-1 hidden sm:block">
                    Календарь
                </h1>

                {/* Prev / Next */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-0.5">
                    <button
                        onClick={() =>
                            setViewStart((d) => addDays(d, -DAYS_COUNT))
                        }
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-600 hover:shadow-sm text-gray-600 dark:text-slate-300 transition-all"
                        title="Предыдущие 30 дней"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-300 px-1 whitespace-nowrap">
                        {format(viewStart, "d MMM", { locale: ru })}
                        {" — "}
                        {format(
                            addDays(viewStart, DAYS_COUNT - 1),
                            "d MMM yyyy",
                            { locale: ru },
                        )}
                    </span>
                    <button
                        onClick={() =>
                            setViewStart((d) => addDays(d, DAYS_COUNT))
                        }
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-600 hover:shadow-sm text-gray-600 dark:text-slate-300 transition-all"
                        title="Следующие 30 дней"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Date picker */}
                <input
                    type="date"
                    value={toDateStr(viewStart)}
                    onChange={(e) => {
                        if (e.target.value)
                            setViewStart(localDate(e.target.value));
                    }}
                    className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-xl text-xs text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:placeholder-slate-400"
                />

                {/* Today button */}
                <button
                    onClick={() => setViewStart(startOfDay(new Date()))}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                >
                    Сегодня
                </button>

                {/* Selection indicator */}
                {selection && (
                    <div className="flex items-center gap-2 ml-auto text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                        <span>Выберите дату окончания в той же строке</span>
                        <button
                            onClick={() => setSelection(null)}
                            className="text-blue-400 hover:text-blue-700"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Calendar grid ── */}
            <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">
                {rooms.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-500 text-sm">
                        Нет номеров. Добавьте номера в разделе «Номера».
                    </div>
                ) : (
                    /* Inner: wide enough to scroll horizontally */
                    <div style={{ minWidth: ROOM_COL_W + CELL_W * DAYS_COUNT }}>
                        {/* ── Date headers row ── */}
                        <div
                            className="flex sticky top-0 z-20 bg-white dark:bg-slate-800 shadow-sm"
                            style={{ height: CELL_H }}
                        >
                            {/* Corner cell */}
                            <div
                                className="sticky left-0 z-30 shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 border-r border-b border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide"
                                style={{ width: ROOM_COL_W, height: CELL_H }}
                            >
                                №
                            </div>

                            {/* Day columns */}
                            {days.map((day, idx) => (
                                <div
                                    key={idx}
                                    className={headerCellCls(day)}
                                    style={{ width: CELL_W, height: CELL_H }}
                                >
                                    <span
                                        className={`text-base font-bold leading-none ${
                                            isToday(day)
                                                ? "text-amber-600"
                                                : isWeekend(day)
                                                  ? "text-red-500"
                                                  : "text-gray-800 dark:text-slate-200"
                                        }`}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    <span
                                        className={`text-[10px] font-medium mt-0.5 uppercase ${
                                            isToday(day)
                                                ? "text-amber-500"
                                                : isWeekend(day)
                                                  ? "text-red-400"
                                                  : "text-gray-400 dark:text-slate-500"
                                        }`}
                                    >
                                        {DAY_RU[day.getDay()]}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* ── Room rows ── */}
                        {rooms.map((room) => {
                            const roomBookings = bookings.filter((b) => {
                                if (b.roomId !== room.id) return false;
                                const vs = toDateStr(days[0]);
                                const ve = toDateStr(days[days.length - 1]);
                                return b.startDate <= ve && b.endDate >= vs;
                            });

                            return (
                                <div
                                    key={room.id}
                                    className="flex border-b border-gray-100 dark:border-slate-700 group"
                                    style={{ height: CELL_H }}
                                >
                                    {/* Sticky room label */}
                                    <div
                                        className="sticky left-0 z-10 shrink-0 flex flex-col items-center justify-center bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 group-hover:bg-gray-50/80 dark:group-hover:bg-slate-700/50 transition-colors"
                                        style={{
                                            width: ROOM_COL_W,
                                            height: CELL_H,
                                        }}
                                    >
                                        <span className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-none">
                                            {room.number}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                                            {room.floor} эт.
                                        </span>
                                    </div>

                                    {/* Day cells + booking blocks */}
                                    <div
                                        className="relative flex"
                                        style={{ height: CELL_H }}
                                    >
                                        {/* ── Day cells (click targets) ── */}
                                        {days.map((day, idx) => {
                                            const dayStr = toDateStr(day);
                                            return (
                                                <div
                                                    key={idx}
                                                    className={dayCellCls(
                                                        room,
                                                        day,
                                                        dayStr,
                                                    )}
                                                    style={{
                                                        width: CELL_W,
                                                        height: CELL_H,
                                                    }}
                                                    onClick={() =>
                                                        handleCellClick(
                                                            room,
                                                            day,
                                                        )
                                                    }
                                                />
                                            );
                                        })}

                                        {/* ── Booking blocks ── */}
                                        {roomBookings.map((booking) => {
                                            const block =
                                                getBookingBlock(booking);
                                            if (!block) return null;

                                            return (
                                                <div
                                                    key={booking.id}
                                                    className="absolute flex items-center px-2 rounded-md cursor-pointer overflow-hidden shadow-sm hover:brightness-110 transition-all"
                                                    style={{
                                                        top: 8,
                                                        height: CELL_H - 16,
                                                        left: block.left,
                                                        width: block.width,
                                                        backgroundColor:
                                                            booking.color ??
                                                            "#3B82F6",
                                                    }}
                                                    onClick={(e) =>
                                                        handleBookingClick(
                                                            booking,
                                                            e,
                                                        )
                                                    }
                                                >
                                                    <span className="text-white text-xs font-medium truncate leading-tight">
                                                        {booking.guestName}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ══════════════════ BOOKING INFO POPUP ══════════════════════════════════ */}
            {activeBooking && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
                    onClick={() => {
                        setActiveBooking(null);
                        setDeleteConfirm(false);
                    }}
                >
                    <div
                        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg leading-tight">
                                    {activeBooking.guestName}
                                </h3>
                                {activeRoom && (
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                                        Номер {activeRoom.number}
                                        {activeRoom.comment
                                            ? ` · ${activeRoom.comment}`
                                            : ""}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setActiveBooking(null);
                                    setDeleteConfirm(false);
                                }}
                                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Details */}
                        <div className="space-y-2.5 text-sm mb-5">
                            <div className="flex items-center gap-2.5 text-gray-600 dark:text-slate-400">
                                <CalendarDays className="w-4 h-4 shrink-0 text-gray-400 dark:text-slate-500" />
                                <span>
                                    {format(
                                        parseISO(activeBooking.startDate),
                                        "d MMM yyyy",
                                        { locale: ru },
                                    )}
                                    {" — "}
                                    {format(
                                        parseISO(activeBooking.endDate),
                                        "d MMM yyyy",
                                        { locale: ru },
                                    )}
                                </span>
                            </div>
                            {activeBooking.phone && (
                                <div className="flex items-center gap-2.5 text-gray-600 dark:text-slate-400">
                                    <Phone className="w-4 h-4 shrink-0 text-gray-400 dark:text-slate-500" />
                                    <span>{activeBooking.phone}</span>
                                </div>
                            )}
                            {activeBooking.notes && (
                                <div className="flex items-start gap-2.5 text-gray-600 dark:text-slate-400">
                                    <FileText className="w-4 h-4 shrink-0 text-gray-400 dark:text-slate-500 mt-0.5" />
                                    <span className="break-words">
                                        {activeBooking.notes}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Delete */}
                        {!deleteConfirm ? (
                            <button
                                onClick={() => setDeleteConfirm(true)}
                                className="w-full py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors"
                            >
                                Удалить бронирование
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-600 dark:text-slate-400 text-center">
                                    Удалить это бронирование?
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDeleteConfirm(false)}
                                        className="flex-1 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Нет
                                    </button>
                                    <button
                                        onClick={handleDeleteBooking}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════ NEW BOOKING MODAL ═══════════════════════════════════ */}
            {showBookingModal && pendingRange && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
                    onClick={() => {
                        setShowBookingModal(false);
                        setPendingRange(null);
                    }}
                >
                    <div
                        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
                            Новое бронирование
                        </h2>

                        {/* Date range + room badge */}
                        <div className="flex flex-wrap items-center gap-2 mb-5">
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 rounded-lg px-2.5 py-1">
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                                <span>
                                    {format(pendingRange.start, "d MMM", {
                                        locale: ru,
                                    })}
                                    {" — "}
                                    {format(pendingRange.end, "d MMM yyyy", {
                                        locale: ru,
                                    })}
                                </span>
                            </div>
                            {pendingRoom && (
                                <span className="text-sm text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 rounded-lg px-2.5 py-1">
                                    Номер {pendingRoom.number}
                                </span>
                            )}
                        </div>

                        <form
                            onSubmit={handleBookingSubmit}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Имя гостя{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={bookingForm.guestName}
                                    onChange={(e) =>
                                        setBookingForm((f) => ({
                                            ...f,
                                            guestName: e.target.value,
                                        }))
                                    }
                                    placeholder="Иван Иванов"
                                    required
                                    autoFocus
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Телефон
                                </label>
                                <input
                                    type="tel"
                                    value={bookingForm.phone}
                                    onChange={(e) =>
                                        setBookingForm((f) => ({
                                            ...f,
                                            phone: e.target.value,
                                        }))
                                    }
                                    placeholder="+7 900 000-00-00"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Заметки
                                </label>
                                <textarea
                                    value={bookingForm.notes}
                                    onChange={(e) =>
                                        setBookingForm((f) => ({
                                            ...f,
                                            notes: e.target.value,
                                        }))
                                    }
                                    placeholder="Дополнительная информация..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowBookingModal(false);
                                        setPendingRange(null);
                                    }}
                                    className="flex-1 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Забронировать
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
