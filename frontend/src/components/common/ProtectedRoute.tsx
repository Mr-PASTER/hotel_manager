import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

interface ProtectedRouteProps {
    children: ReactNode;
    /** When true, only users with role === 'admin' may access this route. */
    adminOnly?: boolean;
}

/**
 * Wraps a route (or a layout) with authentication and optional role guards.
 *
 * - Not authenticated  → redirect to /login
 * - Not admin (adminOnly) → render an "access denied" message
 * - Otherwise          → render children
 */
const ProtectedRoute = ({
    children,
    adminOnly = false,
}: ProtectedRouteProps) => {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user?.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <ShieldOff className="w-8 h-8 text-red-500 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-slate-200">
                    Доступ запрещён
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs">
                    У вас недостаточно прав для просмотра этого раздела.
                    Обратитесь к администратору.
                </p>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
