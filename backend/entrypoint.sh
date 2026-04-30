#!/bin/sh
set -e

echo "=== Hotel Manager Backend Starting ==="

# 1. Убеждаемся что директория для БД существует
mkdir -p /app/data
echo "[1/3] Data directory: OK"

# 2. Запускаем миграции (безопасно — не падает если таблиц ещё нет)
echo "[2/3] Running migrations..."
python migrate.py

# 3. Запускаем сервер
echo "[3/3] Starting Uvicorn..."
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips='*' \
    --log-level info \
    --access-log
