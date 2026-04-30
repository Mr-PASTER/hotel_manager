import os
import sqlite3


def get_db_path() -> str:
    """Извлекает путь к SQLite из DATABASE_URL или возвращает дефолтный."""
    db_url = os.environ.get("DATABASE_URL", "sqlite:///./hotel.db")
    # sqlite:////app/data/hotel.db  → /app/data/hotel.db
    # sqlite:///./hotel.db         → ./hotel.db
    if db_url.startswith("sqlite:////"):
        return "/" + db_url[len("sqlite:////"):]
    if db_url.startswith("sqlite:///"):
        return db_url[len("sqlite:///"):]
    return "hotel.db"


def table_exists(cursor, table_name: str) -> bool:
    """Проверяет существование таблицы в SQLite."""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
        (table_name,)
    )
    return cursor.fetchone() is not None


def run_migration():
    db_path = get_db_path()
    print(f"Starting database migration on: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # ── bookings ────────────────────────────────────────────────────────
        if not table_exists(cursor, "bookings"):
            print("SKIP: table 'bookings' does not exist yet (will be created by SQLAlchemy).")
        else:
            cursor.execute("PRAGMA table_info(bookings);")
            columns = [row[1] for row in cursor.fetchall()]

            if "group_size" not in columns:
                print("Adding group_size to bookings...")
                cursor.execute("ALTER TABLE bookings ADD COLUMN group_size INTEGER DEFAULT 1;")
                print("OK")
            else:
                print("SKIP: group_size already exists.")

        # ── employees ───────────────────────────────────────────────────────
        if not table_exists(cursor, "employees"):
            print("SKIP: table 'employees' does not exist yet (will be created by SQLAlchemy).")
        else:
            cursor.execute("PRAGMA table_info(employees);")
            emp_columns = [row[1] for row in cursor.fetchall()]

            for col, ddl in [
                ("nextcloud_username", "ALTER TABLE employees ADD COLUMN nextcloud_username TEXT;"),
                ("max_username",       "ALTER TABLE employees ADD COLUMN max_username TEXT;"),
                (
                    "notification_preference",
                    "ALTER TABLE employees ADD COLUMN notification_preference VARCHAR DEFAULT 'all';",
                ),
            ]:
                if col not in emp_columns:
                    print(f"Adding {col} to employees...")
                    cursor.execute(ddl)
                    print("OK")
                else:
                    print(f"SKIP: {col} already exists.")

        # ── rooms: clean_status ──────────────────────────────────────────────
        if not table_exists(cursor, "rooms"):
            print("SKIP: table 'rooms' does not exist yet (will be created by SQLAlchemy).")
        else:
            cursor.execute("PRAGMA table_info(rooms);")
            room_columns = [row[1] for row in cursor.fetchall()]

            if "clean_status" not in room_columns:
                print("Adding clean_status to rooms...")
                cursor.execute(
                    "ALTER TABLE rooms ADD COLUMN clean_status VARCHAR DEFAULT 'clean';"
                )
                print("OK: clean_status added.")
            else:
                print("SKIP: clean_status already exists.")

        conn.commit()
        print("Migration complete ✓")
    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
