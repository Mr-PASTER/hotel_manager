import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Hotel, Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const LoginPage = () => {
    const [loginValue, setLoginValue] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    /* Already logged in — send straight to the dashboard */
    if (isAuthenticated) {
        return <Navigate to="/rooms" replace />;
    }

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!loginValue.trim() || !password) return;
        setError("");
        setLoading(true);
        const result = await login(loginValue.trim(), password);
        setLoading(false);
        if (result.success) {
            navigate("/rooms", { replace: true });
        } else {
            setError(result.error ?? "Ошибка входа. Попробуйте ещё раз.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 flex items-center justify-center p-4">
            {/* Decorative blobs */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-700/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-slate-600/20 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-[380px]">
                {/* ── Card ───────────────────────────────────────────── */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                    {/* Card header */}
                    <div className="bg-gradient-to-br from-slate-800 to-sky-700 px-8 pt-8 pb-7 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/15 border border-white/20 rounded-2xl backdrop-blur-sm mb-4 shadow-lg">
                            <Hotel className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-extrabold text-white tracking-tight">
                            Hotel Manager
                        </h1>
                        <p className="text-sky-200 text-sm mt-1.5 font-light">
                            Система управления отелем
                        </p>
                    </div>

                    {/* Card body */}
                    <div className="px-8 py-7">
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5 text-center">
                            Войдите в свою учётную запись
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            noValidate
                            className="space-y-4"
                        >
                            {/* Login field */}
                            <div>
                                <label
                                    htmlFor="login"
                                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                                >
                                    Логин
                                </label>
                                <input
                                    id="login"
                                    type="text"
                                    value={loginValue}
                                    onChange={(e) =>
                                        setLoginValue(e.target.value)
                                    }
                                    placeholder="Введите логин"
                                    autoComplete="username"
                                    autoFocus
                                    disabled={loading}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm
                             text-gray-900 dark:text-slate-100
                             placeholder-gray-400 dark:placeholder-slate-400
                             bg-gray-50 dark:bg-slate-700
                             focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition-colors duration-150"
                                    required
                                />
                            </div>

                            {/* Password field */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                                >
                                    Пароль
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        placeholder="Введите пароль"
                                        autoComplete="current-password"
                                        disabled={loading}
                                        className="w-full px-3.5 py-2.5 pr-11 border border-gray-300 dark:border-slate-600 rounded-xl text-sm
                               text-gray-900 dark:text-slate-100
                               placeholder-gray-400 dark:placeholder-slate-400
                               bg-gray-50 dark:bg-slate-700
                               focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                               disabled:opacity-60 disabled:cursor-not-allowed
                               transition-colors duration-150"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
                                        disabled={loading}
                                        aria-label={
                                            showPassword
                                                ? "Скрыть пароль"
                                                : "Показать пароль"
                                        }
                                        className="absolute inset-y-0 right-0 px-3.5 flex items-center
                               text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300
                               disabled:opacity-40 transition-colors duration-150"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-2.5 bg-red-50 border border-red-200
                             rounded-xl px-3.5 py-3 text-sm text-red-700"
                                >
                                    <span className="mt-px text-red-400 text-base leading-none select-none">
                                        ✕
                                    </span>
                                    {error}
                                </div>
                            )}

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={
                                    loading || !loginValue.trim() || !password
                                }
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-1
                           bg-sky-600 hover:bg-sky-700 active:bg-sky-800
                           disabled:bg-sky-300 disabled:cursor-not-allowed
                           text-white text-sm font-semibold rounded-xl
                           shadow-md shadow-sky-200
                           focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
                           transition-all duration-150"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LogIn className="w-4 h-4" />
                                )}
                                {loading ? "Выполняется вход…" : "Войти"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer note */}
                <p className="mt-5 text-center text-xs text-slate-400">
                    Hotel Manager &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
