// src/store/settingsStore.ts
import { create } from "zustand";
import type {
    Settings,
    NotificationTemplate,
    TemplateType,
    ChatNotificationPayload,
} from "../types";
import { api, ApiError } from "../api/client";

interface TemplateRaw {
    id: string;
    name: string;
    template: string;
    type: TemplateType;
    is_default: boolean;
    created_at: string;
}

interface SettingsRaw {
    nextcloud_url: string;
    conversation_token: string;
    nc_login: string;
    nc_password: string;
    auto_notify: boolean;
    updated_at: string;
}

function mapTemplate(raw: TemplateRaw): NotificationTemplate {
    return {
        id: raw.id,
        name: raw.name,
        template: raw.template,
        type: raw.type,
        isDefault: raw.is_default,
    };
}

const DEFAULT_SETTINGS: Settings = {
    nextcloudUrl: "",
    conversationToken: "",
    ncLogin: "",
    ncPassword: "",
    templates: [],
    autoNotify: false,
};

interface SettingsState {
    settings: Settings;
    loading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (
        data: Partial<Settings>,
    ) => Promise<{ success: boolean; error?: string }>;
    addTemplate: (
        template: Omit<NotificationTemplate, "id">,
    ) => Promise<{ success: boolean; error?: string }>;
    updateTemplate: (
        id: string,
        data: Partial<NotificationTemplate>,
    ) => Promise<{ success: boolean; error?: string }>;
    removeTemplate: (
        id: string,
    ) => Promise<{ success: boolean; error?: string }>;
    sendNotification: (
        payload: ChatNotificationPayload,
    ) => Promise<{ success: boolean; error?: string }>;
    testNotification: () => Promise<{ success: boolean; error?: string }>;
    renderTemplate: (
        type: TemplateType,
        vars: Record<string, string>,
    ) => string;
    exportCalendar: (from?: string, to?: string) => Promise<void>;
    exportDatabase: () => Promise<void>;
    importDatabase: (file: File) => Promise<{ success: boolean; error?: string }>;
}

// Helper: add Bearer token to direct fetch calls (required by require_admin)
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const { useAuthStore } = await import("./authStore");
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, credentials: "include", headers });
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
    settings: DEFAULT_SETTINGS,
    loading: false,

    fetchSettings: async () => {
        set({ loading: true });
        try {
            const [raw, tplsRaw] = await Promise.all([
                api.get<SettingsRaw>("/api/settings"),
                api.get<TemplateRaw[]>("/api/settings/templates"),
            ]);
            set({
                settings: {
                    nextcloudUrl: raw.nextcloud_url,
                    conversationToken: raw.conversation_token,
                    ncLogin: raw.nc_login,
                    ncPassword: raw.nc_password,
                    autoNotify: raw.auto_notify,
                    templates: tplsRaw.map(mapTemplate),
                },
            });
        } finally {
            set({ loading: false });
        }
    },

    updateSettings: async (data) => {
        try {
            const body: Record<string, unknown> = {};
            if (data.nextcloudUrl !== undefined)
                body.nextcloud_url = data.nextcloudUrl;
            if (data.conversationToken !== undefined)
                body.conversation_token = data.conversationToken;
            if (data.ncLogin !== undefined) body.nc_login = data.ncLogin;
            if (data.ncPassword !== undefined) body.nc_password = data.ncPassword;
            if (data.autoNotify !== undefined)
                body.auto_notify = data.autoNotify;
            const raw = await api.patch<SettingsRaw>("/api/settings", body);
            set((s) => ({
                settings: {
                    ...s.settings,
                    nextcloudUrl: raw.nextcloud_url,
                    conversationToken: raw.conversation_token,
                    ncLogin: raw.nc_login,
                    ncPassword: raw.nc_password,
                    autoNotify: raw.auto_notify,
                },
            }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка сохранения",
            };
        }
    },

    addTemplate: async (template) => {
        try {
            const raw = await api.post<TemplateRaw>("/api/settings/templates", {
                name: template.name,
                template: template.template,
                type: template.type,
            });
            set((s) => ({
                settings: {
                    ...s.settings,
                    templates: [...s.settings.templates, mapTemplate(raw)],
                },
            }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error:
                    e instanceof ApiError
                        ? e.message
                        : "Ошибка создания шаблона",
            };
        }
    },

    updateTemplate: async (id, data) => {
        try {
            const body: Record<string, unknown> = {};
            if (data.name !== undefined) body.name = data.name;
            if (data.template !== undefined) body.template = data.template;
            const raw = await api.patch<TemplateRaw>(
                `/api/settings/templates/${id}`,
                body,
            );
            set((s) => ({
                settings: {
                    ...s.settings,
                    templates: s.settings.templates.map((t) =>
                        t.id === id ? mapTemplate(raw) : t,
                    ),
                },
            }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error:
                    e instanceof ApiError
                        ? e.message
                        : "Ошибка обновления шаблона",
            };
        }
    },

    removeTemplate: async (id) => {
        try {
            await api.delete(`/api/settings/templates/${id}`);
            set((s) => ({
                settings: {
                    ...s.settings,
                    templates: s.settings.templates.filter((t) => t.id !== id),
                },
            }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error:
                    e instanceof ApiError
                        ? e.message
                        : "Ошибка удаления шаблона",
            };
        }
    },

    sendNotification: async (payload) => {
        try {
            await api.post("/api/notifications/send", {
                type: payload.type,
                room_number: payload.roomNumber,
                guest_name: payload.guestName,
                start_date: payload.startDate,
                end_date: payload.endDate,
                custom_text: payload.customText,
            });
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка отправки",
            };
        }
    },

    testNotification: async () => {
        try {
            await api.post("/api/settings/test-notification");
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка теста",
            };
        }
    },

    renderTemplate: (type, vars) => {
        const tpl = get().settings.templates.find((t) => t.type === type);
        if (!tpl) return "";
        return tpl.template.replace(
            /\{\{(\w+)\}\}/g,
            (_, key) => vars[key] ?? `{{${key}}}`,
        );
    },

    exportCalendar: async (from?: string, to?: string) => {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const query = params.toString() ? `?${params.toString()}` : "";
        const baseUrl = import.meta.env.VITE_API_URL ?? "";
        const resp = await authFetch(`${baseUrl}/api/admin/calendar/export${query}`);
        if (!resp.ok) throw new Error("Ошибка экспорта");
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `calendar${from ? `_from_${from}` : ""}${to ? `_to_${to}` : ""}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    exportDatabase: async () => {
        const baseUrl = import.meta.env.VITE_API_URL ?? "";
        const resp = await authFetch(`${baseUrl}/api/admin/db/export`);
        if (!resp.ok) throw new Error("Ошибка экспорта БД");
        const blob = await resp.blob();
        const contentDisp = resp.headers.get("Content-Disposition") ?? "";
        const match = contentDisp.match(/filename=([^\s;]+)/);
        const filename = match ? match[1] : "hotel_manager.dump";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importDatabase: async (file: File) => {
        try {
            const baseUrl = import.meta.env.VITE_API_URL ?? "";
            const formData = new FormData();
            formData.append("file", file);
            const resp = await authFetch(`${baseUrl}/api/admin/db/import`, {
                method: "POST",
                body: formData,
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                return {
                    success: false,
                    error: err?.detail?.message ?? "Ошибка импорта",
                };
            }
            const data = await resp.json();
            return { success: true, error: data.message };
        } catch (e) {
            return { success: false, error: "Ошибка загрузки файла" };
        }
    },
}));
