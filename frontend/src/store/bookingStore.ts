// src/store/bookingStore.ts
import { create } from "zustand";
import type { Booking } from "../types";
import { api, ApiError } from "../api/client";

// Backend returns snake_case
interface BookingRaw {
    id: string;
    room_id: string;
    guest_name: string;
    phone?: string;
    notes?: string;
    start_date: string;
    end_date: string;
    color: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

function mapBooking(raw: BookingRaw): Booking {
    return {
        id: raw.id,
        roomId: raw.room_id,
        guestName: raw.guest_name,
        phone: raw.phone,
        notes: raw.notes,
        startDate: raw.start_date,
        endDate: raw.end_date,
        color: raw.color,
    };
}

interface BookingParams {
    roomId?: string;
    from?: string;
    to?: string;
}

interface BookingState {
    bookings: Booking[];
    loading: boolean;

    fetchBookings: (params?: BookingParams) => Promise<void>;
    addBooking: (
        booking: Omit<Booking, "id" | "color">,
    ) => Promise<{ success: boolean; error?: string }>;
    updateBooking: (id: string, data: Partial<Booking>) => Promise<void>;
    removeBooking: (id: string) => Promise<void>;
    getBookingsForRoom: (roomId: string) => Booking[];
    hasConflict: (
        roomId: string,
        start: string,
        end: string,
        excludeId?: string,
    ) => boolean;
}

export const useBookingStore = create<BookingState>()((set, get) => ({
    bookings: [],
    loading: false,

    fetchBookings: async (params) => {
        set({ loading: true });
        try {
            const query = new URLSearchParams();
            if (params?.roomId) query.set("roomId", params.roomId);
            if (params?.from) query.set("from", params.from);
            if (params?.to) query.set("to", params.to);
            const qs = query.toString() ? `?${query}` : "";
            const raw = await api.get<BookingRaw[]>(`/api/bookings${qs}`);
            set({ bookings: raw.map(mapBooking) });
        } finally {
            set({ loading: false });
        }
    },

    addBooking: async (booking) => {
        try {
            const raw = await api.post<BookingRaw>("/api/bookings", {
                room_id: booking.roomId,
                guest_name: booking.guestName,
                phone: booking.phone || null,
                notes: booking.notes || null,
                start_date: booking.startDate,
                end_date: booking.endDate,
            });
            set((s) => ({ bookings: [...s.bookings, mapBooking(raw)] }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error:
                    e instanceof ApiError ? e.message : "Ошибка бронирования",
            };
        }
    },

    updateBooking: async (id, data) => {
        try {
            const body: Record<string, unknown> = {};
            if (data.roomId !== undefined) body.room_id = data.roomId;
            if (data.guestName !== undefined) body.guest_name = data.guestName;
            if (data.phone !== undefined) body.phone = data.phone;
            if (data.notes !== undefined) body.notes = data.notes;
            if (data.startDate !== undefined) body.start_date = data.startDate;
            if (data.endDate !== undefined) body.end_date = data.endDate;
            const raw = await api.patch<BookingRaw>(
                `/api/bookings/${id}`,
                body,
            );
            set((s) => ({
                bookings: s.bookings.map((b) =>
                    b.id === id ? mapBooking(raw) : b,
                ),
            }));
        } catch {
            /* rethrow for component */
        }
    },

    removeBooking: async (id) => {
        try {
            await api.delete(`/api/bookings/${id}`);
            set((s) => ({ bookings: s.bookings.filter((b) => b.id !== id) }));
        } catch {
            /* ignore */
        }
    },

    getBookingsForRoom: (roomId) =>
        get().bookings.filter((b) => b.roomId === roomId),

    hasConflict: (roomId, start, end, excludeId) =>
        get().bookings.some((b) => {
            if (b.roomId !== roomId) return false;
            if (excludeId && b.id === excludeId) return false;
            return start <= b.endDate && end >= b.startDate;
        }),
}));
