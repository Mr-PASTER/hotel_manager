import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, Spin, App as AntdApp } from 'antd'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import RoomsPage from './pages/RoomsPage'
import EmployeesPage from './pages/EmployeesPage'
import GuestsPage from './pages/GuestsPage'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth()
    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
                <Spin size="large" />
            </div>
        )
    }
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
                <Spin size="large" />
            </div>
        )
    }

    return (
        <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<RoomsPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/guests" element={<GuestsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#c9a84c',
                    colorBgBase: '#0f1117',
                    colorBgContainer: '#181c27',
                    colorBgElevated: '#1e2333',
                    colorBorder: '#2a2f42',
                    colorText: '#e8eaf0',
                    colorTextSecondary: '#8b92a8',
                    borderRadius: 10,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                },
            }}
        >
            <AntdApp>
                <BrowserRouter>
                    <AuthProvider>
                        <AppRoutes />
                    </AuthProvider>
                </BrowserRouter>
            </AntdApp>
        </ConfigProvider>
    )
}
