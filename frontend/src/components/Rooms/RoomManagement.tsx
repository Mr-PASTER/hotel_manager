import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, X, BedDouble } from "lucide-react";
import { useRoomStore } from "../../store/roomStore";
import type { Room, RoomStatus } from "../../types";

// Status config
interface StatusBadgeConfig {
    label: string;
    badgeClass: string;
    dotClass: string;
}
const STATUS_CONFIG: Record<RoomStatus, StatusBadgeConfig> = {
    clean: {
        label: "Чисто",
        badgeClass:
            "bg-green-100 text-green-800 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-800",
        dotClass: "bg-green-500",
    },
    dirty: {
        label: "Грязно",
        badgeClass:
            "bg-red-100 text-red-800 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800",
        dotClass: "bg-red-500",
    },
};

// Form types
interface RoomFormData {
    number: string;
    floor: string;
    comment: string;
}
interface FormErrors {
    number?: string;
    floor?: string;
}
const DEFAULT_FORM: RoomFormData = { number: "", floor: "1", comment: "" };

// StatusBadge
interface StatusBadgeProps {
    status: RoomStatus;
}
function StatusBadge({ status }: StatusBadgeProps) {
    const cfg = STATUS_CONFIG[status];
    return (
        <span
            className={
                "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full " +
                cfg.badgeClass
            }
        >
            <span className={"w-1.5 h-1.5 rounded-full " + cfg.dotClass} />
            {cfg.label}
        </span>
    );
}

// RoomCard
interface RoomCardProps {
    room: Room;
    isConfirmingDelete: boolean;
    onEdit: (room: Room) => void;
    onDeleteRequest: (room: Room) => void;
    onDeleteConfirm: (room: Room) => void;
    onDeleteCancel: () => void;
}
function RoomCard({
    room,
    isConfirmingDelete,
    onEdit,
    onDeleteRequest,
    onDeleteConfirm,
    onDeleteCancel,
}: RoomCardProps) {
    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <BedDouble className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="text-2xl font-bold text-gray-800 dark:text-slate-200 tracking-tight">
                            {"\u2116"}
                            {room.number}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 pl-6">
                        {room.floor} этаж
                    </p>
                </div>
                <StatusBadge status={room.status} />
            </div>
            {room.comment && (
                <p className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 line-clamp-2 leading-relaxed">
                    {room.comment}
                </p>
            )}
            {isConfirmingDelete ? (
                <div className="flex items-center gap-2 pt-1 border-t border-red-100 dark:border-red-900/30">
                    <span className="text-sm text-red-600 flex-1 font-medium">
                        Удалить номер?
                    </span>
                    <button
                        onClick={() => onDeleteConfirm(room)}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                        Да, удалить
                    </button>
                    <button
                        onClick={onDeleteCancel}
                        className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                        Нет
                    </button>
                </div>
            ) : (
                <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
                    <button
                        onClick={() => onEdit(room)}
                        className="flex items-center justify-center gap-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-brand-700 bg-gray-50 dark:bg-slate-700/50 hover:bg-brand-50 border border-gray-200 dark:border-slate-600 hover:border-brand-200 px-3 py-2 rounded-lg transition-colors flex-1 font-medium"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        Изменить
                    </button>
                    <button
                        onClick={() => onDeleteRequest(room)}
                        className="flex items-center justify-center gap-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-red-700 bg-gray-50 dark:bg-slate-700/50 hover:bg-red-50 border border-gray-200 dark:border-slate-600 hover:border-red-200 px-3 py-2 rounded-lg transition-colors flex-1 font-medium"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Удалить
                    </button>
                </div>
            )}
        </div>
    );
}

// RoomModal
interface RoomModalProps {
    isOpen: boolean;
    editingRoom: Room | null;
    formData: RoomFormData;
    errors: FormErrors;
    onChange: (field: keyof RoomFormData, value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}
function RoomModal({
    isOpen,
    editingRoom,
    formData,
    errors,
    onChange,
    onSubmit,
    onClose,
}: RoomModalProps) {
    if (!isOpen) return null;
    const base =
        "w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors dark:bg-slate-700 dark:border-slate-600";
    const ok =
        base + " border-gray-300 focus:ring-brand-400 focus:border-brand-400";
    const err =
        base +
        " border-red-400 focus:ring-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-500";
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-slate-700">
                    <h2
                        id="modal-title"
                        className="text-xl font-bold text-gray-800 dark:text-slate-200"
                    >
                        {editingRoom ? "Редактировать номер" : "Добавить номер"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        aria-label="Закрыть"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form
                    onSubmit={onSubmit}
                    noValidate
                    className="px-6 py-5 space-y-4"
                >
                    <div>
                        <label
                            htmlFor="room-number"
                            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                        >
                            Номер комнаты{" "}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="room-number"
                            type="text"
                            value={formData.number}
                            onChange={(e) => onChange("number", e.target.value)}
                            placeholder="Например: 101"
                            autoFocus
                            className={errors.number ? err : ok}
                        />
                        {errors.number && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.number}
                            </p>
                        )}
                    </div>
                    <div>
                        <label
                            htmlFor="room-floor"
                            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                        >
                            Этаж <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="room-floor"
                            type="number"
                            value={formData.floor}
                            onChange={(e) => onChange("floor", e.target.value)}
                            min={1}
                            max={99}
                            placeholder="1"
                            className={errors.floor ? err : ok}
                        />
                        {errors.floor && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.floor}
                            </p>
                        )}
                    </div>
                    <div>
                        <label
                            htmlFor="room-comment"
                            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                        >
                            Краткий комментарий{" "}
                            <span className="text-gray-400 dark:text-slate-500 font-normal">
                                (необязательно)
                            </span>
                        </label>
                        <input
                            id="room-comment"
                            type="text"
                            value={formData.comment}
                            onChange={(e) =>
                                onChange("comment", e.target.value)
                            }
                            placeholder="Люкс, угловой, с балконом..."
                            maxLength={80}
                            className={ok}
                        />
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">
                            {formData.comment.length}/80
                        </p>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
                        >
                            {editingRoom
                                ? "Сохранить изменения"
                                : "Добавить номер"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Main export
export default function RoomManagement() {
    const { rooms, addRoom, updateRoom, removeRoom, fetchRooms } =
        useRoomStore();

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [formData, setFormData] = useState<RoomFormData>(DEFAULT_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
    const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

    const floors = useMemo(
        () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
        [rooms],
    );
    const filteredRooms = useMemo(() => {
        const base =
            selectedFloor === "all"
                ? rooms
                : rooms.filter((r) => r.floor === selectedFloor);
        return [...base].sort((a, b) =>
            a.number.localeCompare(b.number, undefined, { numeric: true }),
        );
    }, [rooms, selectedFloor]);

    const openAddModal = () => {
        setEditingRoom(null);
        setFormData(DEFAULT_FORM);
        setErrors({});
        setIsModalOpen(true);
    };
    const openEditModal = (room: Room) => {
        setEditingRoom(room);
        setFormData({
            number: room.number,
            floor: String(room.floor),
            comment: room.comment ?? "",
        });
        setErrors({});
        setIsModalOpen(true);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRoom(null);
        setFormData(DEFAULT_FORM);
        setErrors({});
    };

    const handleFormChange = (field: keyof RoomFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (field in errors)
            setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validate = (): boolean => {
        const e: FormErrors = {};
        if (!formData.number.trim()) {
            e.number = "Номер комнаты обязателен";
        } else if (
            rooms.find(
                (r) =>
                    r.number.trim() === formData.number.trim() &&
                    r.id !== editingRoom?.id,
            )
        ) {
            e.number = "Комната с таким номером уже существует";
        }
        const fl = parseInt(formData.floor, 10);
        if (!formData.floor || isNaN(fl) || fl < 1)
            e.floor = "Этаж должен быть числом не менее 1";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        const payload = {
            number: formData.number.trim(),
            floor: parseInt(formData.floor, 10),
            ...(formData.comment.trim()
                ? { comment: formData.comment.trim() }
                : {}),
        };
        if (editingRoom) {
            const res = await updateRoom(editingRoom.id, payload);
            if (res.success) {
                toast.success("Номер " + payload.number + " обновлён", {
                    icon: "✏️",
                });
                closeModal();
            } else {
                toast.error(res.error ?? "Ошибка обновления");
            }
        } else {
            const res = await addRoom(payload);
            if (res.success) {
                toast.success("Номер " + payload.number + " добавлен", {
                    icon: "🛏️",
                });
                closeModal();
            } else {
                toast.error(res.error ?? "Ошибка создания");
            }
        }
    };

    const handleDeleteRequest = (room: Room) => setDeletingRoomId(room.id);
    const handleDeleteConfirm = async (room: Room) => {
        const res = await removeRoom(room.id);
        if (res.success) {
            toast.success("Номер " + room.number + " удалён", { icon: "🗑️" });
        } else {
            toast.error(res.error ?? "Ошибка удаления");
        }
        setDeletingRoomId(null);
    };
    const handleDeleteCancel = () => setDeletingRoomId(null);

    const totalLabel =
        rooms.length === 1 ? "номер" : rooms.length < 5 ? "номера" : "номеров";

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-brand-100 rounded-xl flex-shrink-0">
                        <BedDouble className="w-6 h-6 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-slate-200 leading-tight">
                            Управление номерами
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 hidden sm:block">
                            {rooms.length} {totalLabel} всего
                        </p>
                    </div>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm flex-shrink-0 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    <span>Добавить номер</span>
                </button>
            </div>

            {/* Floor filter tabs */}
            {floors.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setSelectedFloor("all")}
                        className={
                            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors " +
                            (selectedFloor === "all"
                                ? "bg-brand-600 text-white shadow-sm"
                                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600")
                        }
                    >
                        Все этажи
                        <span
                            className={
                                "ml-1.5 text-xs font-bold rounded-full px-1.5 py-0.5 " +
                                (selectedFloor === "all"
                                    ? "bg-white/25 text-white"
                                    : "bg-white dark:bg-slate-600 text-gray-500 dark:text-slate-300")
                            }
                        >
                            {rooms.length}
                        </span>
                    </button>
                    {floors.map((floor) => {
                        const cnt = rooms.filter(
                            (r) => r.floor === floor,
                        ).length;
                        const active = selectedFloor === floor;
                        return (
                            <button
                                key={floor}
                                onClick={() => setSelectedFloor(floor)}
                                className={
                                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors " +
                                    (active
                                        ? "bg-brand-600 text-white shadow-sm"
                                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600")
                                }
                            >
                                {floor} этаж
                                <span
                                    className={
                                        "ml-1.5 text-xs font-bold rounded-full px-1.5 py-0.5 " +
                                        (active
                                            ? "bg-white/25 text-white"
                                            : "bg-white dark:bg-slate-600 text-gray-500 dark:text-slate-300")
                                    }
                                >
                                    {cnt}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty state / grid */}
            {filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-500">
                    <div className="p-4 bg-gray-100 dark:bg-slate-700 rounded-2xl mb-4">
                        <BedDouble className="w-10 h-10 opacity-60" />
                    </div>
                    <p className="text-lg font-medium text-gray-500 dark:text-slate-400 mb-1">
                        Номеров не найдено
                    </p>
                    <p className="text-sm text-center max-w-xs">
                        {rooms.length === 0
                            ? "Нажмите «Добавить номер», чтобы создать первый номер"
                            : "Нет номеров на выбранном этаже"}
                    </p>
                    {rooms.length === 0 && (
                        <button
                            onClick={openAddModal}
                            className="mt-5 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Добавить первый номер
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRooms.map((room) => (
                        <RoomCard
                            key={room.id}
                            room={room}
                            isConfirmingDelete={deletingRoomId === room.id}
                            onEdit={openEditModal}
                            onDeleteRequest={handleDeleteRequest}
                            onDeleteConfirm={handleDeleteConfirm}
                            onDeleteCancel={handleDeleteCancel}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <RoomModal
                isOpen={isModalOpen}
                editingRoom={editingRoom}
                formData={formData}
                errors={errors}
                onChange={handleFormChange}
                onSubmit={handleSubmit}
                onClose={closeModal}
            />
        </div>
    );
}
