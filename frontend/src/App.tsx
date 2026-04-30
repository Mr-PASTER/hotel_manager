import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";

import Layout from "./components/Layout/Layout";
import LoginPage from "./components/Auth/LoginPage";
import ProtectedRoute from "./components/common/ProtectedRoute";

import RoomManagement from "./components/Rooms/RoomManagement";
import RoomStatusPanel from "./components/RoomStatus/RoomStatusPanel";
import StaffManagement from "./components/Staff/StaffManagement";
import BookingCalendar from "./components/Calendar/BookingCalendar";
import SettingsPanel from "./components/Settings/SettingsPanel";

function App() {
    const { isAuthenticated, isInitializing, initAuth } = useAuthStore();

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-white">
                    <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Загрузка...</p>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Root redirect */}
            <Route
                path="/"
                element={
                    <Navigate
                        to={isAuthenticated ? "/rooms" : "/login"}
                        replace
                    />
                }
            />

            {/* Protected layout shell — all authenticated users */}
            <Route
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                {/* Available to all authenticated roles */}
                <Route path="/rooms" element={<RoomManagement />} />
                <Route path="/room-status" element={<RoomStatusPanel />} />

                {/* Admin-only routes */}
                <Route
                    path="/staff"
                    element={
                        <ProtectedRoute adminOnly>
                            <StaffManagement />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/calendar"
                    element={
                        <ProtectedRoute adminOnly>
                            <BookingCalendar />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute adminOnly>
                            <SettingsPanel />
                        </ProtectedRoute>
                    }
                />
            </Route>

            {/* Catch-all — redirect to rooms (ProtectedRoute will handle unauth) */}
            <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
    );
}

export default App;
