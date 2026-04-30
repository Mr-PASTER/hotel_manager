// ─── Auth & Users ────────────────────────────────────────────────────────────
export type UserRole = "admin" | "moderator";

export interface User {
    id: string;
    login: string;
    role: UserRole;
    name?: string;
}

// ─── Rooms ───────────────────────────────────────────────────────────────────
export type RoomStatus = "clean" | "dirty";

export interface Room {
    id: string;
    number: string;
    floor: number;
    comment?: string;
    status: RoomStatus;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────
export interface Booking {
    id: string;
    roomId: string;
    guestName: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    notes?: string;
    phone?: string;
    color?: string;
}

// ─── Staff ───────────────────────────────────────────────────────────────────
export interface StaffMember {
    id: string;
    login: string;
    password: string;
    role: UserRole;
    name?: string;
    phone?: string;
    notes?: string;
    createdAt: string;
}

// ─── Notification Templates ───────────────────────────────────────────────────
export type TemplateType =
    | "clean_room"
    | "dirty_room"
    | "booking_created"
    | "booking_cancelled"
    | "custom";

export interface NotificationTemplate {
    id: string;
    name: string;
    template: string;
    type: TemplateType;
    isDefault?: boolean; // returned by API
}

// ─── Nextcloud Talk Settings ──────────────────────────────────────────────────
export interface Settings {
    nextcloudUrl: string; // https://nextcloud.example.com
    conversationToken: string; // Токен комнаты/разговора
    botToken: string; // Секрет/токен бота
    templates: NotificationTemplate[];
    autoNotify: boolean;
}

// ─── Chat Notification ────────────────────────────────────────────────────────
export interface ChatNotificationPayload {
    type: TemplateType;
    roomNumber?: string;
    guestName?: string;
    startDate?: string;
    endDate?: string;
    customText?: string;
}
