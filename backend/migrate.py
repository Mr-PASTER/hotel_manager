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

        # Migrate employees table: add max_username
        if "max_username" not in emp_columns:
            print("Adding max_username to employees table...")
            cursor.execute("ALTER TABLE employees ADD COLUMN max_username TEXT;")
            print("Successfully added max_username to employees.")
        else:
            print("max_username already exists in employees.")

        # Migrate employees table: add notification_preference
        if "notification_preference" not in emp_columns:
            print("Adding notification_preference to employees table...")
            cursor.execute(
                "ALTER TABLE employees ADD COLUMN notification_preference VARCHAR DEFAULT 'all';"
            )
            print("Successfully added notification_preference to employees.")
        else:
            print("notification_preference already exists in employees.")

        # Migrate room_assignments table: add completed and completed_at
        cursor.execute("PRAGMA table_info(room_assignments);")
        assign_columns = [row[1] for row in cursor.fetchall()]

        if "completed" not in assign_columns:
            print("Adding completed to room_assignments table...")
            cursor.execute(
                "ALTER TABLE room_assignments ADD COLUMN completed BOOLEAN DEFAULT 0;"
            )
            print("Successfully added completed to room_assignments.")
        else:
            print("completed already exists in room_assignments.")

        if "completed_at" not in assign_columns:
            print("Adding completed_at to room_assignments table...")
            cursor.execute(
                "ALTER TABLE room_assignments ADD COLUMN completed_at DATETIME;"
            )
            print("Successfully added completed_at to room_assignments.")
        else:
            print("completed_at already exists in room_assignments.")

        conn.commit()
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()
        print("Migration complete.")


if __name__ == "__main__":
    run_migration()
