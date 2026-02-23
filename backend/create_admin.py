"""
Скрипт для создания первого администратора.
Запустить один раз из папки backend/:

python create_admin.py
"""

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
    print("=== Создание администратора Hotel Manager ===")
    name = input("ФИО администратора (например: Петров Пётр Петрович): ").strip()
    login = input("Логин: ").strip()
    passwd = input("Пароль: ").strip()

    if not name or not login or not passwd:
        print("❌ Все поля обязательны.")
        sys.exit(1)

    create_admin(name, login, passwd)
