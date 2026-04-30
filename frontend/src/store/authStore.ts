// src/store/authStore.ts
import { create } from "zustand";
import type { User } from "../types";
import { api, ApiError } from "../api/client";

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isInitializing: boolean;

    initAuth: () => Promise<void>;
    login: (
        login: string,
        password: string,
    ) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    setAccessToken: (token: string) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isInitializing: true,

    initAuth: async () => {
        try {
            const res = await fetch("/api/auth/refresh", {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                set({ isInitializing: false });
                return;
            }
            const { accessToken } = await res.json();
            set({ accessToken });
            const user = await api.get<User>("/api/auth/me");
            set({ user, isAuthenticated: true, isInitializing: false });
        } catch {
            set({ isInitializing: false });
        }
    },

    login: async (login, password) => {
        try {
            const res = await api.post<{ accessToken: string; user: User }>(
                "/api/auth/login",
                { login, password },
            );
            set({
                user: res.user,
                accessToken: res.accessToken,
                isAuthenticated: true,
            });
            return { success: true };
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : "Ошибка входа";
            return { success: false, error: msg };
        }
    },

    logout: async () => {
        try {
            await api.post("/api/auth/logout");
        } catch {
            /* ignore */
        }
        get().clearAuth();
    },

    setAccessToken: (token) => set({ accessToken: token }),

    clearAuth: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
}));
