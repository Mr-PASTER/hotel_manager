import React, { useState, useEffect, useCallback } from "react";
import { ArrowUp, Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useRoomStore } from "../../store/roomStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { RoomStatus } from "../../types";

type FilterTab = "all" | RoomStatus;

const STATUS_LABEL: Record<RoomStatus, string> = {
    clean: "Чисто",
    dirty: "Грязно",
};

const STATUS_ICON: Record<RoomStatus, string> = {
    clean: "✅",
    dirty: "🔴",
};

const STATUS_BADGE: Record<RoomStatus, string> = ["clean", "dirty"].reduce(
    (acc, s) => ({
        ...acc,
        [s]:
            s === "clean"
                ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    }),
    {} as Record<RoomStatus, string>,
);

const RoomStatusPanel: React.FC = () => {
    const { rooms, setRoomStatus, fetchRooms } = useRoomStore();
    const { settings, sendNotification, fetchSettings } = useSettingsStore();

    const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
    const [isSending, setIsSending] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Scroll-to-top visibility
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    // Counts
    const cleanCount = rooms.filter((r) => r.status === "clean").length;
    const dirtyCount = rooms.filter((r) => r.status === "dirty").length;

    const tabCounts: Record<FilterTab, number> = {
        all: rooms.length,
        clean: cleanCount,
        dirty: dirtyCount,
    };

    const filteredRooms =
        activeFilter === "all"
            ? rooms
            : rooms.filter((r) => r.status === activeFilter);

    // Send all statuses as a single message
    const handleSendAll = async () => {
        if (
            !settings.nextcloudUrl ||
            !settings.conversationToken ||
            !settings.ncLogin ||
            !settings.ncPassword
        ) {
            toast.error("Настройте Nextcloud Talk в настройках");
            return;
        }

        const lines = rooms.map((room) => {
            const floorPart = `этаж ${room.floor}`;
            const icon = room.status === "clean" ? "✅" : "🧹";
            const label = room.status === "clean" ? "Чисто" : "Грязно";
            return `• Номер ${room.number} (${floorPart}): ${icon} ${label}`;
        });

        const customText = `📊 Статус номеров:\n${lines.join("\n")}`;

        setIsSending(true);
        try {
            await sendNotification({ type: "custom", customText });
            toast.success("Статусы отправлены в чат");
        } catch {
            toast.error("Ошибка при отправке статусов");
        } finally {
            setIsSending(false);
        }
    };

    const TABS: { key: FilterTab; label: string }[] = [
        { key: "all", label: "Все" },
        { key: "clean", label: "Чисто" },
        { key: "dirty", label: "Грязно" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
                {/* Header row: title + send button */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                        Статус номеров
                    </h1>
                    <button
                        onClick={handleSendAll}
                        disabled={isSending || rooms.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {isSending ? "Отправка…" : "Отправить статусы в чат"}
                    </button>
                </div>

                {/* Summary strip */}
                <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm">
                    <span className="font-medium text-gray-500 dark:text-slate-400">
                        Итого:
                    </span>
                    <span className="font-semibold text-green-700 dark:text-green-400">
                        ✅ {cleanCount} чистых
                    </span>
                    <span className="text-gray-300 dark:text-slate-600 select-none">
                        /
                    </span>
                    <span className="font-semibold text-red-700 dark:text-red-400">
                        🧹 {dirtyCount} грязных
                    </span>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-slate-800 w-fit">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveFilter(key)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                activeFilter === key
                                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
                                    : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                            }`}
                        >
                            {label}
                            <span
                                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                                    activeFilter === key
                                        ? "bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300"
                                        : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                                }`}
                            >
                                {tabCounts[key]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Rooms list / table */}
                {filteredRooms.length === 0 ? (
                    <div className="py-16 text-center text-gray-400 dark:text-slate-500 text-sm">
                        Нет номеров для отображения
                    </div>
                ) : (
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                        {/* Table header (hidden on mobile) */}
                        <div className="hidden sm:grid grid-cols-[80px_80px_1fr_110px_200px] gap-x-4 px-4 py-2.5 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                            <span>Номер</span>
                            <span>Этаж</span>
                            <span>Комментарий</span>
                            <span>Статус</span>
                            <span>Переключить</span>
                        </div>

                        {/* Rows */}
                        <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
                            {filteredRooms.map((room, idx) => {
                                const isEven = idx % 2 === 0;
                                return (
                                    <li
                                        key={room.id}
                                        className={`group transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
                                            isEven
                                                ? "bg-white dark:bg-slate-800"
                                                : "bg-gray-50/50 dark:bg-slate-800/50"
                                        }`}
                                    >
                                        {/* Desktop row */}
                                        <div className="hidden sm:grid grid-cols-[80px_80px_1fr_110px_200px] gap-x-4 items-center px-4 py-2.5">
                                            {/* Номер */}
                                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                                {room.number}
                                            </span>

                                            {/* Этаж */}
                                            <span className="text-sm text-gray-500 dark:text-slate-400">
                                                {room.floor}
                                            </span>

                                            {/* Комментарий */}
                                            <span className="text-sm text-gray-500 dark:text-slate-400 truncate">
                                                {room.comment || (
                                                    <span className="italic opacity-40">
                                                        —
                                                    </span>
                                                )}
                                            </span>

                                            {/* Статус badge */}
                                            <span
                                                className={
                                                    STATUS_BADGE[room.status]
                                                }
                                            >
                                                {STATUS_ICON[room.status]}{" "}
                                                {STATUS_LABEL[room.status]}
                                            </span>

                                            {/* Toggle buttons */}
                                            <div className="flex gap-1.5">
                                                {(
                                                    [
                                                        "clean",
                                                        "dirty",
                                                    ] as RoomStatus[]
                                                ).map((s) => {
                                                    const active =
                                                        room.status === s;
                                                    return (
                                                        <button
                                                            key={s}
                                                            disabled={active}
                                                            onClick={async () => {
                                                                const res =
                                                                    await setRoomStatus(
                                                                        room.id,
                                                                        s,
                                                                    );
                                                                if (
                                                                    !res.success
                                                                )
                                                                    toast.error(
                                                                        res.error ??
                                                                            "Ошибка обновления статуса",
                                                                    );
                                                            }}
                                                            className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                                                                active
                                                                    ? s ===
                                                                      "clean"
                                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default ring-1 ring-green-300 dark:ring-green-700"
                                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 cursor-default ring-1 ring-red-300 dark:ring-red-700"
                                                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 cursor-pointer"
                                                            }`}
                                                        >
                                                            {STATUS_ICON[s]}
                                                            {STATUS_LABEL[s]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Mobile row */}
                                        <div className="sm:hidden px-4 py-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-base font-bold text-gray-900 dark:text-slate-100">
                                                    № {room.number}
                                                    <span className="ml-2 text-sm font-normal text-gray-400 dark:text-slate-500">
                                                        этаж {room.floor}
                                                    </span>
                                                </span>
                                                <span
                                                    className={
                                                        STATUS_BADGE[
                                                            room.status
                                                        ]
                                                    }
                                                >
                                                    {STATUS_ICON[room.status]}{" "}
                                                    {STATUS_LABEL[room.status]}
                                                </span>
                                            </div>

                                            {room.comment && (
                                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                                    {room.comment}
                                                </p>
                                            )}

                                            <div className="flex gap-2 pt-1">
                                                {(
                                                    [
                                                        "clean",
                                                        "dirty",
                                                    ] as RoomStatus[]
                                                ).map((s) => {
                                                    const active =
                                                        room.status === s;
                                                    return (
                                                        <button
                                                            key={s}
                                                            disabled={active}
                                                            onClick={async () => {
                                                                const res =
                                                                    await setRoomStatus(
                                                                        room.id,
                                                                        s,
                                                                    );
                                                                if (
                                                                    !res.success
                                                                )
                                                                    toast.error(
                                                                        res.error ??
                                                                            "Ошибка обновления статуса",
                                                                    );
                                                            }}
                                                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                                active
                                                                    ? s ===
                                                                      "clean"
                                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default ring-1 ring-green-300 dark:ring-green-700"
                                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 cursor-default ring-1 ring-red-300 dark:ring-red-700"
                                                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 cursor-pointer"
                                                            }`}
                                                        >
                                                            {STATUS_ICON[s]}
                                                            {STATUS_LABEL[s]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>

            {/* Scroll-to-top floating button */}
            <button
                onClick={scrollToTop}
                aria-label="Наверх"
                className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 ${
                    showScrollTop
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 translate-y-4 pointer-events-none"
                }`}
            >
                <ArrowUp className="w-5 h-5" />
            </button>
        </div>
    );
};

export default RoomStatusPanel;
