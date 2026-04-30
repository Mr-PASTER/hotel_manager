FROM python:3.12-slim

WORKDIR /app

# Директория для SQLite БД (монтируется как volume)
RUN mkdir -p /app/data

# Зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Исходный код
COPY . .

# Убираем Windows CRLF и делаем entrypoint исполняемым
RUN sed -i 's/\r//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Запуск через entrypoint (миграции → сервер с логами)
CMD ["/app/entrypoint.sh"]
