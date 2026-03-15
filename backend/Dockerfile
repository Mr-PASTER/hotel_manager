FROM python:3.12-slim

WORKDIR /app

# Создаем директорию для БД, чтобы SQLite не вылетал с ошибкой
RUN mkdir -p /app/data

# Устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем исходный код бэкенда
COPY . .

# При запуске контейнера применяем миграции (если есть) и запускаем сервер
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000"]
