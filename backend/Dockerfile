FROM python:3.12-slim

WORKDIR /app

# Директория для SQLite БД (монтируется как volume)
RUN mkdir -p /app/data

# Зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Исходный код
COPY . .

# Запуск: сначала миграция, потом сервер
CMD ["sh", "-c", "python migrate.py && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
