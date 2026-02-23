import axios from 'axios'

// В dev: VITE_API_URL=http://localhost:8000 (proxy в vite.config.ts добавляет /api)
// В prod: VITE_API_URL=https://your-service.onrender.com (.env.production)
const BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
    baseURL: `${BASE}/api`,
    withCredentials: true,
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Don't redirect for /auth/me - let the AuthContext handle it
            const url = error.config?.url || ''
            if (!url.includes('/auth/me')) {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
