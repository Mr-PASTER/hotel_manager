import axios from 'axios'

// В dev: оставляем пустым, чтобы работал proxy из vite.config.ts
// В prod: задаем полный URL бэкенда через VITE_API_URL
const BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
    baseURL: BASE ? `${BASE}/api` : '/api',
    withCredentials: true,
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Don't redirect for /auth/me - let the AuthContext handle it
            const url = error.config?.url || ''
            if (!url.includes('/auth/me') && !url.includes('/auth/login')) {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
