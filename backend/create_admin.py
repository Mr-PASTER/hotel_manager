"""
Скрипт для создания первого администратора.

Запустить интерактивно:
    docker compose exec backend python create_admin.py

Или через переменные окружения (без TTY):
    docker compose exec -e ADMIN_NAME="Иванов Иван" -e ADMIN_USER=admin -e ADMIN_PASS=secret backend python create_admin.py
"""

import os
import sys
import hashlib
import bcrypt
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models

models.Base.metadata.create_all(bind=engine)


def create_admin(full_name: str, username: str, password: str):
    db: Session = SessionLocal()
    try:
        existing = (
            db.query(models.Employee)
            .filter(models.Employee.username == username)
            .first()
        )
        if existing:
            print(f"❌ Пользователь с логином '{username}' уже существует.")
            return

        admin = models.Employee(
            full_name=full_name,
            role=models.EmployeeRole.admin,
            phone="",
            active=True,
            username=username,
            hashed_password=bcrypt.hashpw(
                hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8"),
                bcrypt.gensalt(),
            ).decode("utf-8"),
        )
        db.add(admin)
        db.commit()
        print(f"✅ Администратор '{full_name}' создан.")
        print(f"   Логин: {username}")
        print(f"   Пароль: {password}")
    finally:
        db.close()


if __name__ == "__main__":
    # Поддержка переменных окружения для автоматического режима
    env_name = os.environ.get("ADMIN_NAME", "").strip()
    env_user = os.environ.get("ADMIN_USER", "").strip()
    env_pass = os.environ.get("ADMIN_PASS", "").strip()

    if env_name and env_user and env_pass:
        print("=== Создание администратора (из переменных окружения) ===")
        create_admin(env_name, env_user, env_pass)
    else:
        print("=== Создание администратора Hotel Manager ===")
        name = input("ФИО администратора (например: Петров Пётр Петрович): ").strip()
        login = input("Логин: ").strip()
        passwd = input("Пароль: ").strip()

        if not name or not login or not passwd:
            print("❌ Все поля обязательны.")
            sys.exit(1)

        create_admin(name, login, passwd)
