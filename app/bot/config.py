import os
from dotenv import load_dotenv

load_dotenv()

# Получаем токен из переменных окружения
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Если токен не задан, модуль будет работать в ограниченном режиме (только логирование)
if not BOT_TOKEN:
    print("WARNING: BOT_TOKEN is not set. Telegram notifications will not work.")
