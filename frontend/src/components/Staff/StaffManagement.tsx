import { useState, useEffect } from "react";
import {
    UserPlus,
    Edit2,
    Trash2,
    Eye,
    EyeOff,
    Copy,
    RefreshCw,
    Shield,
    User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { useStaffStore } from "../../store/staffStore";
import type { StaffMember, UserRole } from "../../types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function generatePassword(len = 12): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(
        { length: len },
        () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
}

const LOGIN_WORDS = [
    "manager",
    "admin",
    "hotel",
    "staff",
    "work",
    "user",
    "desk",
    "front",
    "night",
    "senior",
];

function generateLogin(): string {
    const word = LOGIN_WORDS[Math.floor(Math.random() * LOGIN_WORDS.length)];
    const digits = String(Math.floor(Math.random() * 900) + 100); // 100–999
    return word + digits;
}

async function copyText(text: string, label: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} скопирован`);
    } catch {
        toast.error("Не удалось скопировать");
    }
}

// ─── form types ───────────────────────────────────────────────────────────────

interface AddForm {
    login: string;
    password: string;
    role: UserRole;
    name: string;
    phone: string;
    notes: string;
}

interface EditForm {
    role: UserRole;
    name: string;
    phone: string;
    notes: string;
}

const BLANK_ADD: AddForm = {
    login: "",
    password: "",
    role: "moderator",
    name: "",
    phone: "",
    notes: "",
};

// ─── sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
    if (role === "admin") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">
                <Shield className="w-3 h-3 shrink-0" />
                Администратор
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 whitespace-nowrap">
            <User className="w-3 h-3 shrink-0" />
            Модератор
        </span>
    );
}

interface ModalWrapProps {
    children: React.ReactNode;
    onClose: () => void;
}
function ModalWrap({ children, onClose }: ModalWrapProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StaffManagement() {
    const {
        staff,
        addStaff,
        updateStaff,
        removeStaff,
        resetPassword,
        fetchStaff,
    } = useStaffStore();

    useEffect(() => {
        fetchStaff();
    }, [fetchStaff]);

    // add modal
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState<AddForm>(BLANK_ADD);
    const [addPassVisible, setAddPassVisible] = useState(false);
    const [newMemberInfo, setNewMemberInfo] = useState<{
        login: string;
        password: string;
    } | null>(null);

    // edit modal
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({
        role: "moderator",
        name: "",
        phone: "",
        notes: "",
    });

    // delete confirm
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // reset password
    const [resetPassId, setResetPassId] = useState<string | null>(null);
    const [newGeneratedPwd, setNewGeneratedPwd] = useState<string | null>(null);

    // ── add ──────────────────────────────────────────────────────────────────────

    const openAdd = () => {
        setAddForm(BLANK_ADD);
        setAddPassVisible(false);
        setShowAdd(true);
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const login = addForm.login.trim();
        const password = addForm.password.trim();
        if (!login || !password) {
            toast.error("Заполните обязательные поля");
            return;
        }
        const res = await addStaff({
            login,
            password,
            role: addForm.role,
            name: addForm.name.trim() || undefined,
            phone: addForm.phone.trim() || undefined,
            notes: addForm.notes.trim() || undefined,
        });
        if (res.success) {
            setNewMemberInfo({ login, password });
            setShowAdd(false);
            toast.success("Сотрудник добавлен");
        } else {
            toast.error(res.error ?? "Ошибка создания сотрудника");
        }
    };

    // ── edit ─────────────────────────────────────────────────────────────────────

    const openEdit = (m: StaffMember) => {
        setEditId(m.id);
        setEditForm({
            role: m.role,
            name: m.name ?? "",
            phone: m.phone ?? "",
            notes: m.notes ?? "",
        });
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editId) return;
        const res = await updateStaff(editId, {
            role: editForm.role,
            name: editForm.name.trim() || undefined,
            phone: editForm.phone.trim() || undefined,
            notes: editForm.notes.trim() || undefined,
        });
        if (res.success) {
            setEditId(null);
            toast.success("Данные сотрудника обновлены");
        } else {
            toast.error(res.error ?? "Ошибка обновления");
        }
    };

    const handleResetPassword = async (id: string) => {
        const res = await resetPassword(id);
        if (res.success && res.newPassword) {
            setResetPassId(id);
            setNewGeneratedPwd(res.newPassword);
            toast.success("Пароль сброшен");
        } else {
            toast.error(res.error ?? "Ошибка сброса пароля");
        }
    };

    // ── delete ───────────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteId) return;
        const res = await removeStaff(deleteId);
        if (res.success) {
            setDeleteId(null);
            toast.success("Сотрудник удалён");
        } else {
            toast.error(res.error ?? "Ошибка удаления");
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────

    const fieldCls =
        "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400";
    const btnPrimary =
        "flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-medium transition-colors";
    const btnSecondary =
        "flex-1 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors";
    const btnAction =
        "px-2.5 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-600 dark:text-slate-300 text-xs flex items-center gap-1 shrink-0 transition-colors";

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    Управление персоналом
                </h1>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
                >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">
                        Добавить сотрудника
                    </span>
                    <span className="sm:hidden">Добавить</span>
                </button>
            </div>

            {/* ── New member credentials card ── */}
            {newMemberInfo && (
                <div className="mb-6 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-1.5">
                        <span>✅</span> Данные нового сотрудника
                    </p>
                    <div className="space-y-2">
                        {[
                            { label: "Логин", value: newMemberInfo.login },
                            { label: "Пароль", value: newMemberInfo.password },
                        ].map(({ label, value }) => (
                            <div
                                key={label}
                                className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-800 px-3 py-2"
                            >
                                <p className="text-sm">
                                    <span className="text-gray-500 dark:text-slate-400">
                                        {label}:{" "}
                                    </span>
                                    <span className="font-mono font-medium break-all text-gray-900 dark:text-slate-100">
                                        {value}
                                    </span>
                                </p>
                                <button
                                    onClick={() => copyText(value, label)}
                                    className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 shrink-0"
                                    title={`Скопировать ${label.toLowerCase()}`}
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        <button
                            onClick={() =>
                                copyText(
                                    `Логин: ${newMemberInfo.login}\nПароль: ${newMemberInfo.password}`,
                                    "Данные",
                                )
                            }
                            className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 font-medium"
                        >
                            <Copy className="w-3.5 h-3.5" /> Скопировать всё
                        </button>
                        <button
                            onClick={() => setNewMemberInfo(null)}
                            className="text-xs text-green-600 dark:text-green-400 hover:underline"
                        >
                            Скрыть
                        </button>
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {staff.length === 0 && (
                <div className="py-20 text-center text-gray-400 dark:text-slate-500 text-sm">
                    Нет сотрудников. Нажмите «Добавить», чтобы создать первого.
                </div>
            )}

            {/* ── Desktop table ── */}
            {staff.length > 0 && (
                <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-700">
                            <tr>
                                {[
                                    "Сотрудник",
                                    "Роль",
                                    "Логин",
                                    "Телефон",
                                    "Создан",
                                    "",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {staff.map((m) => (
                                <tr
                                    key={m.id}
                                    className="hover:bg-gray-50/60 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <td className="px-4 py-3 max-w-[200px]">
                                        <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                                            {m.name || "—"}
                                        </p>
                                        {m.notes && (
                                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                                                {m.notes}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <RoleBadge role={m.role} />
                                    </td>
                                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-slate-300">
                                        {m.login}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                                        {m.phone || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                                        {format(
                                            parseISO(m.createdAt),
                                            "dd.MM.yyyy",
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openEdit(m)}
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                title="Редактировать"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setDeleteId(m.id)
                                                }
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                title="Удалить"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Mobile cards ── */}
            {staff.length > 0 && (
                <div className="md:hidden space-y-3">
                    {staff.map((m) => (
                        <div
                            key={m.id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                                        {m.name || m.login}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                        @{m.login}
                                    </p>
                                </div>
                                <RoleBadge role={m.role} />
                            </div>

                            <div className="space-y-2 text-sm">
                                {m.phone && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 dark:text-slate-500 w-16 shrink-0">
                                            Тел.
                                        </span>
                                        <span className="text-gray-700 dark:text-slate-300">
                                            {m.phone}
                                        </span>
                                    </div>
                                )}
                                {m.notes && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-gray-400 dark:text-slate-500 w-16 shrink-0 mt-0.5">
                                            Заметки
                                        </span>
                                        <span className="text-gray-700 dark:text-slate-300 break-words">
                                            {m.notes}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 dark:text-slate-500 w-16 shrink-0">
                                        Создан
                                    </span>
                                    <span className="text-gray-600 dark:text-slate-400">
                                        {format(
                                            parseISO(m.createdAt),
                                            "dd.MM.yyyy",
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                                <button
                                    onClick={() => openEdit(m)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> Изменить
                                </button>
                                <button
                                    onClick={() => setDeleteId(m.id)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Удалить
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ══════════════════════════ ADD MODAL ══════════════════════════════════ */}
            {showAdd && (
                <ModalWrap onClose={() => setShowAdd(false)}>
                    <div className="p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-5">
                            Добавить сотрудника
                        </h2>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            {/* Login */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Логин{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={addForm.login}
                                        onChange={(e) =>
                                            setAddForm((f) => ({
                                                ...f,
                                                login: e.target.value,
                                            }))
                                        }
                                        placeholder="username"
                                        required
                                        autoFocus
                                        className={`${fieldCls} flex-1 min-w-0 font-mono`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAddForm((f) => ({
                                                ...f,
                                                login: generateLogin(),
                                            }))
                                        }
                                        className={btnAction}
                                        title="Сгенерировать логин"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">
                                            Сгенерировать
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            copyText(addForm.login, "Логин")
                                        }
                                        disabled={!addForm.login}
                                        className={`${btnAction} disabled:opacity-40`}
                                        title="Скопировать логин"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">
                                            Копировать
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Пароль{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1 min-w-0">
                                        <input
                                            type={
                                                addPassVisible
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={addForm.password}
                                            onChange={(e) =>
                                                setAddForm((f) => ({
                                                    ...f,
                                                    password: e.target.value,
                                                }))
                                            }
                                            placeholder="Пароль"
                                            required
                                            className={`${fieldCls} pr-9 font-mono`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAddPassVisible((v) => !v)
                                            }
                                            className="absolute right-2.5 top-2.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                                        >
                                            {addPassVisible ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAddForm((f) => ({
                                                ...f,
                                                password: generatePassword(),
                                            }))
                                        }
                                        className={btnAction}
                                        title="Сгенерировать пароль"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">
                                            Сгенерировать
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            copyText(addForm.password, "Пароль")
                                        }
                                        disabled={!addForm.password}
                                        className={`${btnAction} disabled:opacity-40`}
                                        title="Скопировать пароль"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">
                                            Копировать
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Роль
                                </label>
                                <select
                                    value={addForm.role}
                                    onChange={(e) =>
                                        setAddForm((f) => ({
                                            ...f,
                                            role: e.target.value as UserRole,
                                        }))
                                    }
                                    className={fieldCls}
                                >
                                    <option value="moderator">Модератор</option>
                                    <option value="admin">Администратор</option>
                                </select>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Имя{" "}
                                    <span className="text-gray-400 dark:text-slate-500 font-normal">
                                        (необязательно)
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={addForm.name}
                                    onChange={(e) =>
                                        setAddForm((f) => ({
                                            ...f,
                                            name: e.target.value,
                                        }))
                                    }
                                    placeholder="Иван Иванов"
                                    className={fieldCls}
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Телефон{" "}
                                    <span className="text-gray-400 dark:text-slate-500 font-normal">
                                        (необязательно)
                                    </span>
                                </label>
                                <input
                                    type="tel"
                                    value={addForm.phone}
                                    onChange={(e) =>
                                        setAddForm((f) => ({
                                            ...f,
                                            phone: e.target.value,
                                        }))
                                    }
                                    placeholder="+7 900 000-00-00"
                                    className={fieldCls}
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Заметки{" "}
                                    <span className="text-gray-400 dark:text-slate-500 font-normal">
                                        (необязательно)
                                    </span>
                                </label>
                                <textarea
                                    value={addForm.notes}
                                    onChange={(e) =>
                                        setAddForm((f) => ({
                                            ...f,
                                            notes: e.target.value,
                                        }))
                                    }
                                    placeholder="Дополнительная информация..."
                                    rows={2}
                                    className={`${fieldCls} resize-none`}
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className={btnSecondary}
                                >
                                    Отмена
                                </button>
                                <button type="submit" className={btnPrimary}>
                                    Добавить
                                </button>
                            </div>
                        </form>
                    </div>
                </ModalWrap>
            )}

            {/* ══════════════════════════ EDIT MODAL ═════════════════════════════════ */}
            {editId && (
                <ModalWrap onClose={() => setEditId(null)}>
                    <div className="p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
                            Редактировать сотрудника
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
                            Логин изменить нельзя.
                        </p>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Роль
                                </label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) =>
                                        setEditForm((f) => ({
                                            ...f,
                                            role: e.target.value as UserRole,
                                        }))
                                    }
                                    className={fieldCls}
                                >
                                    <option value="moderator">Модератор</option>
                                    <option value="admin">Администратор</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Имя
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) =>
                                        setEditForm((f) => ({
                                            ...f,
                                            name: e.target.value,
                                        }))
                                    }
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Телефон
                                </label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) =>
                                        setEditForm((f) => ({
                                            ...f,
                                            phone: e.target.value,
                                        }))
                                    }
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Заметки
                                </label>
                                <textarea
                                    value={editForm.notes}
                                    onChange={(e) =>
                                        setEditForm((f) => ({
                                            ...f,
                                            notes: e.target.value,
                                        }))
                                    }
                                    rows={2}
                                    className={`${fieldCls} resize-none`}
                                />
                            </div>
                            {/* Reset password info block */}
                            {resetPassId === editId && newGeneratedPwd && (
                                <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
                                        🔑 Новый пароль
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 font-mono text-sm text-amber-900 dark:text-amber-200 break-all">
                                            {newGeneratedPwd}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyText(
                                                    newGeneratedPwd!,
                                                    "Пароль",
                                                )
                                            }
                                            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0"
                                            title="Скопировать"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setEditId(null)}
                                    className={btnSecondary}
                                >
                                    Отмена
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        editId && handleResetPassword(editId)
                                    }
                                    className="flex-1 py-2.5 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl text-sm font-medium transition-colors"
                                >
                                    Сбросить пароль
                                </button>
                                <button type="submit" className={btnPrimary}>
                                    Сохранить
                                </button>
                            </div>
                        </form>
                    </div>
                </ModalWrap>
            )}

            {/* ══════════════════════════ DELETE MODAL ═══════════════════════════════ */}
            {deleteId &&
                (() => {
                    const target = staff.find((s) => s.id === deleteId);
                    return (
                        <ModalWrap onClose={() => setDeleteId(null)}>
                            <div className="p-6">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                                    Удалить сотрудника?
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                                    Сотрудник{" "}
                                    <span className="font-semibold text-gray-800 dark:text-slate-200">
                                        {target?.name || target?.login}
                                    </span>{" "}
                                    будет удалён. Это действие нельзя отменить.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteId(null)}
                                        className={btnSecondary}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        </ModalWrap>
                    );
                })()}
        </div>
    );
}
