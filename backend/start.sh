#!/bin/bash
# Скрипт запуска для Render
set -e

echo "==> Running database migration..."
python migrate.py

echo "==> Starting Hotel Manager API..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
