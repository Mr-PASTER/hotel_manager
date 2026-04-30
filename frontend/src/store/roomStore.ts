// src/store/roomStore.ts
import { create } from "zustand";
import type { Room, RoomStatus } from "../types";
import { api, ApiError } from "../api/client";

interface RoomState {
    rooms: Room[];
    loading: boolean;

    fetchRooms: () => Promise<void>;
    addRoom: (
        room: Omit<Room, "id" | "status">,
    ) => Promise<{ success: boolean; error?: string }>;
    updateRoom: (
        id: string,
        data: Partial<Room>,
    ) => Promise<{ success: boolean; error?: string }>;
    removeRoom: (id: string) => Promise<{ success: boolean; error?: string }>;
    setRoomStatus: (
        id: string,
        status: RoomStatus,
    ) => Promise<{ success: boolean; error?: string }>;
}

export const useRoomStore = create<RoomState>()((set) => ({
    rooms: [],
    loading: false,

    fetchRooms: async () => {
        set({ loading: true });
        try {
            const rooms = await api.get<Room[]>("/api/rooms");
            set({ rooms });
        } finally {
            set({ loading: false });
        }
    },

    addRoom: async (room) => {
        try {
            const created = await api.post<Room>("/api/rooms", room);
            set((s) => ({ rooms: [...s.rooms, created] }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка создания",
            };
        }
    },

    updateRoom: async (id, data) => {
        try {
            const updated = await api.patch<Room>(`/api/rooms/${id}`, data);
            set((s) => ({
                rooms: s.rooms.map((r) => (r.id === id ? updated : r)),
            }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка обновления",
            };
        }
    },

    removeRoom: async (id) => {
        try {
            await api.delete(`/api/rooms/${id}`);
            set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка удаления",
            };
        }
    },

    setRoomStatus: async (id, status) => {
        try {
            const updated = await api.patch<Room>(`/api/rooms/${id}/status`, {
                status,
            });
            set((s) => ({
                rooms: s.rooms.map((r) => (r.id === id ? updated : r)),
            }));
            return { success: true };
        } catch (e) {
            return {
                success: false,
                error: e instanceof ApiError ? e.message : "Ошибка обновления",
            };
        }
    },
}));
