import sqlite3


def run_migration():
    print("Starting database migration...")
    conn = sqlite3.connect("hotel.db")
    cursor = conn.cursor()

    try:
        # Check if the column already exists
        cursor.execute("PRAGMA table_info(bookings);")
        columns = [row[1] for row in cursor.fetchall()]

        if "group_size" not in columns:
            print("Adding group_size to bookings table...")
            cursor.execute(
                "ALTER TABLE bookings ADD COLUMN group_size INTEGER DEFAULT 1;"
            )
            print("Successfully added group_size to bookings.")
        else:
            print("group_size already exists in bookings.")

        # Migrate employees table: add nextcloud_username
        cursor.execute("PRAGMA table_info(employees);")
        emp_columns = [row[1] for row in cursor.fetchall()]

        if "nextcloud_username" not in emp_columns:
            print("Adding nextcloud_username to employees table...")
            cursor.execute("ALTER TABLE employees ADD COLUMN nextcloud_username TEXT;")
            print("Successfully added nextcloud_username to employees.")
        else:
            print("nextcloud_username already exists in employees.")

        # In SQLite, dropping a column is complex.
        # Standard approach requires re-creating the table.
        # However, SQLAlchemy will just ignore the column if we remove it from the model.
        # So we don't strictly *need* to drop `group_size` from `guests` right now for it to work.
        # But for cleanliness, we will leave it as an unused artifact in the guests table,
        # or we could do the full table rebuild. Since we don't want to risk data loss, ignoring is safest.

        conn.commit()
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()
        print("Migration complete.")


if __name__ == "__main__":
    run_migration()
