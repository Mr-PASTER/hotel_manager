import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../api/client'

interface Employee {
    id: number
    full_name: string
    role: string
    username: string | null
}

interface AuthContextType {
    user: Employee | null
    token: string | null
    login: (username: string, password: string) => Promise<void>
    logout: () => void
    isAuthenticated: boolean
    loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<Employee | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Just try fetching /me, cookies will be sent automatically
        api.get('/auth/me')
            .then((r) => setUser(r.data))
            .catch(() => {
                setUser(null)
            })
            .finally(() => setLoading(false))
    }, [])

    const login = async (username: string, password: string) => {
        await api.post('/auth/login', { username, password })
        const me = await api.get('/auth/me')
        setUser(me.data)
    }

    const logout = async () => {
        try {
            await api.post('/auth/logout')
        } finally {
            setUser(null)
        }
    }

    return (
        <AuthContext.Provider value={{ user, token: null, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
