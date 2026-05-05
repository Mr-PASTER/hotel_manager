import { useState, useEffect, useRef } from "react";
import {
    MessageSquare,
    Save,
    Plus,
    Edit2,
    Trash2,
    Send,
    Eye,
    EyeOff,
    Loader2,
    X,
    Copy,
    Check,
    Link,
    Database,
    Download,
    Upload,
    FileSpreadsheet,
    User,
    Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSettingsStore } from "../../store/settingsStore";
import type { NotificationTemplate, TemplateType } from "../../types";

// ─── constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TemplateType, string> = {
    clean_room: "Номер убран",
    dirty_room: "Требуется уборка",
    booking_created: "Новое бронирование",
    booking_cancelled: "Отмена бронирования",
    custom: "Произвольный",
};

const TYPE_COLORS: Record<TemplateType, string> = {
    clean_room:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    dirty_room:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    booking_created:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    booking_cancelled:
        "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    custom: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

const ALL_TYPES: TemplateType[] = [
    "clean_room",
    "dirty_room",
    "booking_created",
    "booking_cancelled",
    "custom",
];

const SAMPLE_VARS: Record<string, string> = {
    roomNumber: "101",
    guestName: "Иван Иванов",
    startDate: "01.12.2024",
    endDate: "05.12.2024",
};

const VAR_HINTS = [
    { key: "{{roomNumber}}", desc: "номер комнаты" },
    { key: "{{guestName}}", desc: "имя гостя" },
    { key: "{{startDate}}", desc: "дата заезда" },
    { key: "{{endDate}}", desc: "дата выезда" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function renderPreview(template: string): string {
    return template.replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => SAMPLE_VARS[key] ?? `{{${key}}}`,
    );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionCard({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60">
                <div className="text-gray-500 dark:text-slate-400">{icon}</div>
                <h2 className="font-semibold text-gray-800 dark:text-slate-100">
                    {title}
                </h2>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function TypeBadge({ type }: { type: TemplateType }) {
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type]}`}
        >
            {TYPE_LABELS[type]}
        </span>
    );
}

// ─── template editor form ─────────────────────────────────────────────────────

interface TemplateForm {
    name: string;
    type: TemplateType;
    template: string;
}

const BLANK_TEMPLATE: TemplateForm = { name: "", type: "custom", template: "" };

interface TemplateEditorProps {
    title: string;
    form: TemplateForm;
    onChange: (f: TemplateForm) => void;
    onSave: (e: React.FormEvent) => void;
    onCancel: () => void;
}

function TemplateEditor({
    title,
    form,
    onChange,
    onSave,
    onCancel,
}: TemplateEditorProps) {
    const fieldCls =
        "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors";

    return (
        <form onSubmit={onSave} className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                {title}
            </h3>

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Название шаблона <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                        onChange({ ...form, name: e.target.value })
                    }
                    placeholder="Мой шаблон"
                    required
                    className={fieldCls}
                />
            </div>

            {/* Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Тип
                </label>
                <select
                    value={form.type}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            type: e.target.value as TemplateType,
                        })
                    }
                    className={fieldCls}
                >
                    {ALL_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                        </option>
                    ))}
                </select>
            </div>

            {/* Template text */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Текст шаблона <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={form.template}
                    onChange={(e) =>
                        onChange({ ...form, template: e.target.value })
                    }
                    placeholder="Введите текст шаблона..."
                    rows={3}
                    required
                    className={`${fieldCls} resize-none font-mono text-xs`}
                />
                {/* Variable hints */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {VAR_HINTS.map((v) => (
                        <button
                            key={v.key}
                            type="button"
                            onClick={() =>
                                onChange({
                                    ...form,
                                    template: form.template + v.key,
                                })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-xs text-gray-600 dark:text-slate-300 transition-colors font-mono"
                            title={`Вставить: ${v.desc}`}
                        >
                            {v.key}
                            <span className="font-sans text-gray-400 dark:text-slate-500 not-italic">
                                — {v.desc}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Live preview */}
            {form.template && (
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> Предпросмотр
                    </p>
                    <div className="bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                        {renderPreview(form.template)}
                    </div>
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                    Отмена
                </button>
                <button
                    type="submit"
                    className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                    <Save className="w-3.5 h-3.5" /> Сохранить
                </button>
            </div>
        </form>
    );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SettingsPanel() {
    const {
        settings,
        updateSettings,
        addTemplate,
        updateTemplate,
        removeTemplate,
        sendNotification,
        fetchSettings,
        testNotification,
        exportCalendar,
        exportDatabase,
        importDatabase,
    } = useSettingsStore();

    // ── Section 1: Nextcloud Talk connection ─────────────────────────────────────
    // ── Section 1: Nextcloud Talk connection ─────────────────────────────────────────────────────
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const [localNextcloudUrl, setLocalNextcloudUrl] = useState(
        settings.nextcloudUrl,
    );
    const [localConversationToken, setLocalConversationToken] = useState(
        settings.conversationToken,
    );
    const [localNcLogin, setLocalNcLogin] = useState(settings.ncLogin);
    const [localNcPassword, setLocalNcPassword] = useState(settings.ncPassword);
    const [showNcPassword, setShowNcPassword] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);
    const [localAutoNotify, setLocalAutoNotify] = useState(settings.autoNotify);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // DB import/export
    const [dbExporting, setDbExporting] = useState(false);
    const [dbImporting, setDbImporting] = useState(false);
    const [calExporting, setCalExporting] = useState(false);
    const [calFrom, setCalFrom] = useState("");
    const [calTo, setCalTo] = useState("");
    const dbFileRef = useRef<HTMLInputElement>(null);

    // Sync local state when settings load from the API
    useEffect(() => {
        setLocalNextcloudUrl(settings.nextcloudUrl);
        setLocalConversationToken(settings.conversationToken);
        setLocalNcLogin(settings.ncLogin);
        setLocalNcPassword(settings.ncPassword);
        setLocalAutoNotify(settings.autoNotify);
    }, [
        settings.nextcloudUrl,
        settings.conversationToken,
        settings.ncLogin,
        settings.ncPassword,
        settings.autoNotify,
    ]);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await updateSettings({
            nextcloudUrl: localNextcloudUrl.trim(),
            conversationToken: localConversationToken.trim(),
            ncLogin: localNcLogin.trim(),
            ncPassword: localNcPassword,
            autoNotify: localAutoNotify,
        });
        setSaving(false);
        if (result.success) toast.success("Настройки сохранены");
        else toast.error(result.error ?? "Ошибка сохранения");
    };

    const handleCopyToken = async () => {
        try {
            await navigator.clipboard.writeText(localConversationToken.trim());
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        } catch {
            toast.error("Не удалось скопировать");
        }
    };

    const handleTestConnection = async () => {
        if (
            !localNextcloudUrl.trim() ||
            !localConversationToken.trim() ||
            !localNcLogin.trim() ||
            !localNcPassword
        ) {
            toast.error("Заполните URL сервера, токен разговора, логин и пароль");
            return;
        }
        // Save current values first so backend uses the new values
        setSaving(true);
        await updateSettings({
            nextcloudUrl: localNextcloudUrl.trim(),
            conversationToken: localConversationToken.trim(),
            ncLogin: localNcLogin.trim(),
            ncPassword: localNcPassword,
            autoNotify: localAutoNotify,
        });
        setSaving(false);
        setTesting(true);
        const result = await testNotification();
        setTesting(false);
        if (result.success) {
            toast.success("Тестовое сообщение отправлено");
        } else {
            toast.error(result.error ?? "Ошибка отправки");
        }
    };

    // DB handlers
    const handleDbExport = async () => {
        setDbExporting(true);
        try {
            await exportDatabase();
            toast.success("База данных скачана");
        } catch {
            toast.error("Ошибка экспорта базы данных");
        } finally {
            setDbExporting(false);
        }
    };

    const handleDbImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setDbImporting(true);
        const result = await importDatabase(file);
        setDbImporting(false);
        e.target.value = "";
        if (result.success) {
            toast.success(result.error ?? "База данных загружена");
        } else {
            toast.error(result.error ?? "Ошибка импорта");
        }
    };

    const handleCalExport = async () => {
        setCalExporting(true);
        try {
            await exportCalendar(calFrom || undefined, calTo || undefined);
            toast.success("Календарь скачан");
        } catch {
            toast.error("Ошибка экспорта календаря");
        } finally {
            setCalExporting(false);
        }
    };

    // ── Section 2: Templates ─────────────────────────────────────────────────────
    const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<TemplateForm>(BLANK_TEMPLATE);
    const [showAddTemplate, setShowAddTemplate] = useState(false);
    const [addForm, setAddForm] = useState<TemplateForm>(BLANK_TEMPLATE);
    const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(
        null,
    );

    const openEditTemplate = (t: NotificationTemplate) => {
        setShowAddTemplate(false);
        setEditTemplateId(t.id);
        setEditForm({ name: t.name, type: t.type, template: t.template });
    };

    const handleSaveEditTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTemplateId) return;
        const res = await updateTemplate(editTemplateId, {
            name: editForm.name.trim(),
            type: editForm.type,
            template: editForm.template.trim(),
        });
        if (res.success) {
            setEditTemplateId(null);
            toast.success("Шаблон обновлён");
        } else {
            toast.error(res.error ?? "Ошибка обновления шаблона");
        }
    };

    const handleAddTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.name.trim() || !addForm.template.trim()) {
            toast.error("Заполните все поля");
            return;
        }
        const res = await addTemplate({
            name: addForm.name.trim(),
            type: addForm.type,
            template: addForm.template.trim(),
        });
        if (res.success) {
            setAddForm(BLANK_TEMPLATE);
            setShowAddTemplate(false);
            toast.success("Шаблон добавлен");
        } else {
            toast.error(res.error ?? "Ошибка добавления шаблона");
        }
    };

    const handleDeleteTemplate = async () => {
        if (!deleteTemplateId) return;
        const res = await removeTemplate(deleteTemplateId);
        if (res.success) {
            setDeleteTemplateId(null);
            toast.success("Шаблон удалён");
        } else {
            toast.error(res.error ?? "Ошибка удаления шаблона");
        }
    };

    // ── Section 3: Test notification ─────────────────────────────────────────────
    const [testType, setTestType] = useState<TemplateType>("booking_created");
    const [testSending, setTestSending] = useState(false);

    const testTemplate = settings.templates.find((t) => t.type === testType);

    const handleSendTest = async () => {
        if (
            !settings.nextcloudUrl ||
            !settings.conversationToken ||
            !settings.ncLogin ||
            !settings.ncPassword
        ) {
            toast.error(
                "Nextcloud Talk не настроен. Заполните и сохраните настройки подключения.",
            );
            return;
        }
        setTestSending(true);
        const result = await sendNotification({
            type: testType,
            roomNumber: SAMPLE_VARS.roomNumber,
            guestName: SAMPLE_VARS.guestName,
            startDate: SAMPLE_VARS.startDate,
            endDate: SAMPLE_VARS.endDate,
        });
        setTestSending(false);
        if (result.success) {
            toast.success("Тестовое уведомление отправлено");
        } else {
            toast.error(result.error ?? "Ошибка отправки");
        }
    };

    // ── Shared field style ────────────────────────────────────────────────────────
    const fieldCls =
        "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-colors";

    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 bg-gray-50 dark:bg-slate-900 min-h-full">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                Настройки
            </h1>

            {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — Nextcloud Talk connection
      ════════════════════════════════════════════════════════════════════════ */}
            <SectionCard
                title="🔗 Nextcloud Talk — подключение"
                icon={<Link className="w-5 h-5" />}
            >
                <form onSubmit={handleSaveSettings} className="space-y-5">
                    {/* Nextcloud server URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            URL сервера Nextcloud
                        </label>
                        <input
                            type="text"
                            value={localNextcloudUrl}
                            onChange={(e) =>
                                setLocalNextcloudUrl(e.target.value)
                            }
                            placeholder="https://nextcloud.example.com"
                            className={fieldCls}
                        />
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
                            Адрес вашего Nextcloud сервера
                        </p>
                    </div>

                    {/* Conversation token */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Токен разговора
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={localConversationToken}
                                onChange={(e) =>
                                    setLocalConversationToken(e.target.value)
                                }
                                placeholder="abc123def456"
                                className={`${fieldCls} flex-1 min-w-0`}
                            />
                            <button
                                type="button"
                                onClick={handleCopyToken}
                                title="Скопировать токен"
                                className="px-3 py-2 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-600 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1.5"
                            >
                                {copiedToken ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
                            Найдите в URL комнаты:{" "}
                            <span className="font-mono">/call/ТУТ</span> или в
                            настройках разговора
                        </p>
                    </div>

                    {/* NC Login */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Логин аккаунта Nextcloud
                        </label>
                        <div className="flex gap-2 items-center">
                            <User className="w-4 h-4 text-gray-400 dark:text-slate-500 shrink-0" />
                            <input
                                type="text"
                                value={localNcLogin}
                                onChange={(e) => setLocalNcLogin(e.target.value)}
                                placeholder="admin"
                                autoComplete="username"
                                className={`${fieldCls} flex-1 min-w-0`}
                            />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
                            Имя пользователя аккаунта Nextcloud Talk (не бот)
                        </p>
                    </div>

                    {/* NC Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Пароль / App Password
                        </label>
                        <div className="flex gap-2">
                            <input
                                type={showNcPassword ? "text" : "password"}
                                value={localNcPassword}
                                onChange={(e) => setLocalNcPassword(e.target.value)}
                                placeholder="•••••••••••"
                                autoComplete="current-password"
                                className={`${fieldCls} flex-1 min-w-0`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNcPassword((v) => !v)}
                                title={showNcPassword ? "Скрыть" : "Показать"}
                                className="px-3 py-2 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-600 dark:text-slate-300 transition-colors shrink-0 flex items-center"
                            >
                                {showNcPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
                            Рекомендуется создать App Password в настройках Nextcloud
                        </p>
                    </div>

                    {/* Auto-notify toggle */}
                    <div className="flex items-center justify-between gap-4 py-1">
                        <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                                Автоуведомления
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                Отправлять уведомления автоматически при
                                изменениях
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={localAutoNotify}
                            onClick={() => setLocalAutoNotify((v) => !v)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                                localAutoNotify
                                    ? "bg-sky-500"
                                    : "bg-gray-200 dark:bg-slate-600"
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
                                    localAutoNotify
                                        ? "translate-x-5"
                                        : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? "Сохранение…" : "Сохранить"}
                        </button>
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testing}
                            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-60 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
                        >
                            {testing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Lock className="w-4 h-4" />
                            )}
                            {testing ? "Проверка…" : "Тест подключения"}
                        </button>
                    </div>
                </form>
            </SectionCard>

            {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — Message templates
      ════════════════════════════════════════════════════════════════════════ */}
            <SectionCard
                title="Шаблоны сообщений"
                icon={<MessageSquare className="w-5 h-5" />}
            >
                <div className="space-y-3">
                    {/* Template list */}
                    {settings.templates.map((t) => {
                        const isEditing = editTemplateId === t.id;

                        return (
                            <div
                                key={t.id}
                                className={`rounded-xl border transition-colors ${
                                    isEditing
                                        ? "border-sky-300 dark:border-sky-700 bg-sky-50/40 dark:bg-sky-900/10"
                                        : "border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50"
                                }`}
                            >
                                {/* Collapsed header */}
                                {!isEditing && (
                                    <div className="flex items-start gap-3 p-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                                    {t.name}
                                                </p>
                                                <TypeBadge type={t.type} />
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-slate-400 font-mono truncate">
                                                {t.template}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() =>
                                                    openEditTemplate(t)
                                                }
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                                                title="Редактировать"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {t.type === "custom" && (
                                                <button
                                                    onClick={() =>
                                                        setDeleteTemplateId(
                                                            t.id,
                                                        )
                                                    }
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Inline editor */}
                                {isEditing && (
                                    <div className="p-4">
                                        <TemplateEditor
                                            title="Редактировать шаблон"
                                            form={editForm}
                                            onChange={setEditForm}
                                            onSave={handleSaveEditTemplate}
                                            onCancel={() =>
                                                setEditTemplateId(null)
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add template form */}
                    {showAddTemplate && (
                        <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10 p-4">
                            <TemplateEditor
                                title="Новый шаблон"
                                form={addForm}
                                onChange={setAddForm}
                                onSave={handleAddTemplate}
                                onCancel={() => {
                                    setShowAddTemplate(false);
                                    setAddForm(BLANK_TEMPLATE);
                                }}
                            />
                        </div>
                    )}

                    {/* Add button */}
                    {!showAddTemplate && (
                        <button
                            onClick={() => {
                                setEditTemplateId(null);
                                setAddForm(BLANK_TEMPLATE);
                                setShowAddTemplate(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50/40 dark:hover:bg-sky-900/10 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Добавить шаблон
                        </button>
                    )}
                </div>
            </SectionCard>

            {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — Test notification
      ════════════════════════════════════════════════════════════════════════ */}
            <SectionCard
                title="Тест уведомления"
                icon={<Send className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    {/* Template type selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Тип уведомления
                        </label>
                        <select
                            value={testType}
                            onChange={(e) =>
                                setTestType(e.target.value as TemplateType)
                            }
                            className={fieldCls}
                        >
                            {ALL_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {TYPE_LABELS[t]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Preview */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Предпросмотр
                            (тестовые данные)
                        </p>
                        {testTemplate ? (
                            <div className="bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap break-words min-h-[2.5rem]">
                                {renderPreview(testTemplate.template)}
                            </div>
                        ) : (
                            <div className="bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-400 dark:text-slate-500 italic">
                                Шаблон для этого типа не найден
                            </div>
                        )}
                    </div>

                    {/* Sample vars legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {Object.entries(SAMPLE_VARS).map(([k, v]) => (
                            <p
                                key={k}
                                className="text-xs text-gray-400 dark:text-slate-500"
                            >
                                <span className="font-mono text-gray-500 dark:text-slate-400">{`{{${k}}}`}</span>{" "}
                                = {v}
                            </p>
                        ))}
                    </div>

                    {/* Send button */}
                    <button
                        onClick={handleSendTest}
                        disabled={testSending || !testTemplate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        {testSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {testSending ? "Отправка…" : "Отправить тест"}
                    </button>

                    {(!settings.nextcloudUrl ||
                        !settings.conversationToken ||
                        !settings.ncLogin ||
                        !settings.ncPassword) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            ⚠️ Nextcloud Talk не настроен — заполните и
                            сохраните настройки подключения выше.
                        </p>
                    )}
                </div>
            </SectionCard>

            {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — Calendar Excel export
      ════════════════════════════════════════════════════════════════════════ */}
            <SectionCard
                title="Экспорт календаря"
                icon={<FileSpreadsheet className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                        Скачать все бронирования в формате Excel (.xlsx).
                        Можно ограничить диапазон дат.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">С даты</label>
                            <input
                                type="date"
                                value={calFrom}
                                onChange={(e) => setCalFrom(e.target.value)}
                                className={fieldCls}
                            />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">По дату</label>
                            <input
                                type="date"
                                value={calTo}
                                onChange={(e) => setCalTo(e.target.value)}
                                className={fieldCls}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCalExport}
                        disabled={calExporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        {calExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {calExporting ? "Формирование…" : "Скачать Excel"}
                    </button>
                </div>
            </SectionCard>

            {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — Database backup / restore
      ════════════════════════════════════════════════════════════════════════ */}
            <SectionCard
                title="База данных"
                icon={<Database className="w-5 h-5" />}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                        Выгрузите базу данных для резервной копии или
                        редактирования, затем загрузите обратно.
                    </p>

                    {/* Export */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleDbExport}
                            disabled={dbExporting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            {dbExporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {dbExporting ? "Выгрузка…" : "Выгрузить БД"}
                        </button>

                        {/* Import */}
                        <button
                            onClick={() => dbFileRef.current?.click()}
                            disabled={dbImporting}
                            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
                        >
                            {dbImporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            {dbImporting ? "Загрузка…" : "Загрузить БД"}
                        </button>
                        <input
                            ref={dbFileRef}
                            type="file"
                            accept=".db,.dump,.sqlite,.sqlite3"
                            className="hidden"
                            onChange={handleDbImport}
                        />
                    </div>

                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ После загрузки БД рекомендуется перезапустить сервер.
                    </p>
                </div>
            </SectionCard>

            {/* ══════════════════════════════════════════════════════════════════════
          DELETE TEMPLATE CONFIRMATION
      ════════════════════════════════════════════════════════════════════════ */}
            {deleteTemplateId &&
                (() => {
                    const tpl = settings.templates.find(
                        (t) => t.id === deleteTemplateId,
                    );
                    return (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                            onClick={() => setDeleteTemplateId(null)}
                        >
                            <div
                                className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 dark:border-slate-700"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                                        Удалить шаблон?
                                    </h2>
                                    <button
                                        onClick={() =>
                                            setDeleteTemplateId(null)
                                        }
                                        className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                                    Шаблон{" "}
                                    <span className="font-semibold text-gray-800 dark:text-slate-200">
                                        «{tpl?.name}»
                                    </span>{" "}
                                    будет удалён без возможности восстановления.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() =>
                                            setDeleteTemplateId(null)
                                        }
                                        className="flex-1 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleDeleteTemplate}
                                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
        </div>
    );
}
