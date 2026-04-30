// src/api/client.ts
// Base URL is empty string (same-origin via nginx proxy in prod,
// or via Vite dev proxy). In dev, set VITE_API_URL='' and use vite proxy.

const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

async function parseError(res: Response): Promise<ApiError> {
    try {
        const body = await res.json();
        return new ApiError(
            body?.error?.message ?? res.statusText,
            res.status,
            body?.error?.code,
        );
    } catch {
        return new ApiError(res.statusText, res.status);
    }
}

async function tryRefreshToken(): Promise<boolean> {
    try {
        const res = await fetch(`${BASE}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        if (!res.ok) return false;
        const data = await res.json();
        // Import dynamically to avoid circular dep
        const { useAuthStore } = await import("../store/authStore");
        useAuthStore.getState().setAccessToken(data.accessToken);
        return true;
    } catch {
        return false;
    }
}

export async function request<T = unknown>(
    path: string,
    options: RequestInit = {},
    retry = true,
): Promise<T> {
    const { useAuthStore } = await import("../store/authStore");
    const token = useAuthStore.getState().accessToken;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, {
        ...options,
        credentials: "include",
        headers,
    });

    if (res.status === 401 && retry) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            return request<T>(path, options, false);
        } else {
            const { useAuthStore: store } = await import("../store/authStore");
            store.getState().clearAuth();
            window.location.href = "/login";
            throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
        }
    }

    if (res.status === 204) return undefined as T;

    if (!res.ok) {
        throw await parseError(res);
    }

    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(path: string) => request<T>(path, { method: "GET" }),
    post: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: "POST",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
    patch: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: "PATCH",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
    delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
