#!/usr/bin/env python3
"""
Hotel Manager — создание первого администратора.

Использование:
    python create_admin.py                      # интерактивный режим
    python create_admin.py --login admin \
                           --name "Иван Петров" # пароль запросится скрытно

В Docker:
    docker-compose exec backend python create_admin.py
"""

import argparse
import asyncio
import getpass
import sys

# ─── CLI args ─────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Создать первого администратора Hotel Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--login", help="Логин администратора")
    parser.add_argument("--name", help="Отображаемое имя (необязательно)")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Создать, даже если администраторы уже существуют",
    )
    return parser.parse_args()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def prompt(label: str, default: str = "") -> str:
    """Запрашивает строку. Пустой ввод возвращает default."""
    suffix = f" [{default}]" if default else ""
    while True:
        raw = sys.stdin.buffer.readline()
        if not raw:
            if default:
                return default
            print("  ✖  Поле обязательно.")
            continue
        value = raw.decode("utf-8", errors="replace").strip()
        if value:
            return value
        if default:
            return default
        print("  ✖  Поле обязательно.")


def prompt_password() -> str:
    """Запрашивает пароль дважды (без отображения)."""
    while True:
        pw1_bytes = getpass.getpass("  Пароль (минимум 8 символов): ").encode(
            "utf-8", errors="replace"
        )
        pw1 = pw1_bytes.decode("utf-8")
        if len(pw1) < 8:
            print("  ✖  Пароль слишком короткий. Минимум 8 символов.\n")
            continue
        pw2_bytes = getpass.getpass("  Повтор пароля: ").encode(
            "utf-8", errors="replace"
        )
        pw2 = pw2_bytes.decode("utf-8")
        if pw1 != pw2:
            print("  ✖  Пароли не совпадают. Попробуйте снова.\n")
            continue
        return pw1


def hr(char: str = "─", width: int = 50) -> str:
    return char * width


# ─── Main ─────────────────────────────────────────────────────────────────────


async def main() -> None:
    args = parse_args()

    print()
    print(hr("═"))
    print("  Hotel Manager — Создание администратора")
    print(hr("═"))
    print()

    # Импортируем после парсинга аргументов, чтобы pydantic-settings не
    # падал с ошибкой при --help без .env файла.
    try:
        from app.core.config import settings as app_settings  # noqa: F401
        from app.core.database import AsyncSessionLocal, Base, engine
        from app.core.security import hash_password
        from app.models.user import User, UserRole
        from sqlalchemy import func, select
    except Exception as exc:
        print(f"  ✖  Ошибка импорта: {exc}")
        print("     Убедитесь, что .env файл существует и DATABASE_URL задан.")
        sys.exit(1)

    # ── Создаём таблицы если их нет ───────────────────────────────────────────
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        print(f"  ✖  Не удалось подключиться к БД: {exc}")
        print("     Проверьте DATABASE_URL и доступность PostgreSQL.")
        sys.exit(1)

    # ── Проверяем существующих администраторов ─────────────────────────────────
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(func.count()).select_from(User).where(User.role == UserRole.admin)
        )
        admin_count: int = result.scalar_one()

    if admin_count > 0 and not args.force:
        print(f"  ℹ  В системе уже {admin_count} администратор(ов).")
        print("     Для принудительного создания добавьте флаг --force.")
        print()
        # Предлагаем продолжить или выйти
        answer = input("  Продолжить всё равно? [y/N]: ").strip().lower()
        if answer not in ("y", "yes", "д", "да"):
            print("\n  Отменено.\n")
            sys.exit(0)
        print()

    # ── Сбор данных ────────────────────────────────────────────────────────────
    print("  Заполните данные нового администратора:")
    print()

    login = args.login or prompt("  Логин")
    display_name = (
        args.name
        if args.name is not None
        else prompt("  Имя (для отображения)", default=login)
    )
    password = prompt_password()

    # ── Проверка уникальности логина ───────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.login == login))
        if existing.scalar_one_or_none():
            print(f"\n  ✖  Пользователь с логином «{login}» уже существует.\n")
            sys.exit(1)

        # ── Создание пользователя ──────────────────────────────────────────────
        new_admin = User(
            login=login,
            password_hash=hash_password(password),
            role=UserRole.admin,
            name=display_name.strip() or None,
        )
        db.add(new_admin)
        await db.commit()
        await db.refresh(new_admin)

    # ── Результат ──────────────────────────────────────────────────────────────
    print()
    print(hr())
    print("  ✔  Администратор успешно создан!")
    print()
    print(f"     Логин : {new_admin.login}")
    print(f"     Имя   : {new_admin.name or '—'}")
    print(f"     Роль  : admin")
    print(f"     ID    : {new_admin.id}")
    print()
    print("  Теперь можно войти на сайте.")
    print(hr())
    print()


if __name__ == "__main__":
    asyncio.run(main())
