import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
    Menu,
    X,
    Home,
    BedDouble,
    Users,
    Calendar,
    Settings,
    LogOut,
    Hotel,
    Sun,
    Moon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";
import type { User } from "../../types";

/* ─── Types ─────────────────────────────────────────────────── */

interface NavItem {
    to: string;
    icon: LucideIcon;
    label: string;
    adminOnly: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { to: "/rooms", icon: Home, label: "Номера", adminOnly: false },
    {
        to: "/room-status",
        icon: BedDouble,
        label: "Состояние номеров",
        adminOnly: false,
    },
    { to: "/staff", icon: Users, label: "Сотрудники", adminOnly: true },
    { to: "/calendar", icon: Calendar, label: "Календарь", adminOnly: true },
    { to: "/settings", icon: Settings, label: "Настройки", adminOnly: true },
];

/* ─── Sidebar content (extracted to avoid recreating on each render) ─── */

interface SidebarContentProps {
    user: User | null;
    visibleItems: NavItem[];
    roleLabel: string;
    onLinkClick: () => void;
    onLogout: () => void;
}

const SidebarContent = ({
    user,
    visibleItems,
    roleLabel,
    onLinkClick,
    onLogout,
}: SidebarContentProps) => {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <div className="flex flex-col h-full bg-slate-800 text-white overflow-hidden">
            {/* ── Logo ── */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700 flex-shrink-0">
                <div className="p-2 bg-sky-500 rounded-xl flex-shrink-0">
                    <Hotel className="w-5 h-5 text-white" />
                </div>
                <div>
                    <span className="text-base font-bold leading-none tracking-wide">
                        Hotel Manager
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Управление отелем
                    </p>
                </div>
            </div>

            {/* ── Navigation ── */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
                {visibleItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onLinkClick}
                        className={({ isActive }) =>
                            [
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 select-none",
                                isActive
                                    ? "bg-sky-600 text-white shadow-sm"
                                    : "text-slate-300 hover:bg-slate-700 hover:text-white",
                            ].join(" ")
                        }
                    >
                        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* ── Theme toggle ── */}
            <div className="px-3 pb-2 flex-shrink-0">
                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-all duration-150 text-slate-300 hover:bg-slate-700 hover:text-white select-none"
                >
                    {theme === "dark" ? (
                        <Sun className="w-[18px] h-[18px] flex-shrink-0" />
                    ) : (
                        <Moon className="w-[18px] h-[18px] flex-shrink-0" />
                    )}
                    <span className="truncate">
                        {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
                    </span>
                </button>
            </div>

            {/* ── User panel ── */}
            <div className="border-t border-slate-700 px-4 py-4 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0 text-sm font-bold uppercase">
                        {(user?.name ?? user?.login ?? "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate leading-tight">
                            {user?.name ?? user?.login}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {roleLabel}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-red-600/80 hover:text-white rounded-lg transition-colors duration-150"
                >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    Выйти из системы
                </button>
            </div>
        </div>
    );
};

/* ─── Main Layout ──────────────────────────────────────────── */

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const isAdmin = user?.role === "admin";
    const roleLabel = isAdmin ? "Администратор" : "Модератор";
    const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
            {/* ─── Desktop sidebar (always visible ≥ md) ─────────── */}
            <aside className="hidden md:flex flex-col w-64 flex-shrink-0 shadow-xl">
                <SidebarContent
                    user={user}
                    visibleItems={visibleItems}
                    roleLabel={roleLabel}
                    onLinkClick={closeSidebar}
                    onLogout={handleLogout}
                />
            </aside>

            {/* ─── Mobile: backdrop overlay ────────────────────────── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* ─── Mobile: slide-in drawer ─────────────────────────── */}
            <aside
                className={[
                    "fixed inset-y-0 left-0 z-50 w-64 flex flex-col shadow-2xl",
                    "transform transition-transform duration-300 ease-in-out md:hidden",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
                aria-label="Боковое меню"
            >
                {/* Close button inside drawer */}
                <button
                    onClick={closeSidebar}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    aria-label="Закрыть меню"
                >
                    <X className="w-5 h-5" />
                </button>

                <SidebarContent
                    user={user}
                    visibleItems={visibleItems}
                    roleLabel={roleLabel}
                    onLinkClick={closeSidebar}
                    onLogout={handleLogout}
                />
            </aside>

            {/* ─── Right-side content column ───────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Mobile top header bar */}
                <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-800 text-white shadow-lg flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        aria-label="Открыть меню"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-sky-500 rounded-lg">
                            <Hotel className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-[15px] tracking-wide">
                            Hotel Manager
                        </span>
                    </div>
                </header>

                {/* Page content via Outlet */}
                <main className="flex-1 overflow-y-auto scrollbar-thin">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
