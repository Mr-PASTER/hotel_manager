# Telegram Bot Module

Модуль для отправки уведомлений персоналу отеля через Telegram.

## Возможности
- Уведомление о назначении на уборку или ремонт.
- Уведомление о снятии с задачи.
- Кнопка "Работа выполнена" в сообщении, которая автоматически обновляет статус номера в базе данных.
- Поддержка отправки по `telegram_id`, номеру телефона или имени пользователя (при наличии данных в БД).

## Установка и Настройка

1.  **Токен бота**:
    Убедитесь, что переменная окружения `BOT_TOKEN` установлена.
    ```bash
    export BOT_TOKEN="ваш_токен"
    ```
    В Windows PowerShell:
    ```powershell
    $env:BOT_TOKEN="ваш_токен"
    ```

2.  **Зависимости**:
    Модуль требует `aiogram>=3.0`. Убедитесь, что он установлен:
    ```bash
    pip install aiogram
    ```

3.  **Интеграция**:
    Для работы бота в основном приложении (FastAPI), необходимо запустить polling в фоновом режиме при старте приложения.

    Пример добавления в `app/main.py`:
    ```python
    import asyncio
    from app.bot.service import bot_service

    @app.on_event("startup")
    async def startup_event():
        # Запуск бота в фоне
        asyncio.create_task(bot_service.start_polling())
    ```

## Использование в коде

```python
from app.bot.service import bot_service
from app.models import User

# Отправка назначения
# user может быть объектом User, telegram_id (int/str), phone (str) или username (str)
await bot_service.notify_assignment(
    user_identifier=staff_user,
    room_number="101",
    room_id=1,
    task_type="cleaning" # или "repair"
)

# Отправка отмены
await bot_service.notify_removal(
    user_identifier=staff_user,
    room_number="101"
)
```

## Структура
- `config.py`: Конфигурация.
- `service.py`: Основной класс `TelegramService` для отправки сообщений.
- `handlers.py`: Обработчики событий (нажатие кнопок).
- `keyboards.py`: Клавиатуры (кнопки).
- `callbacks.py`: Структуры данных для callback-запросов.

## Примечание
Для отправки сообщений пользователю по номеру телефона или username, пользователь **должен быть зарегистрирован в базе данных** с валидным `telegram_id`. Бот не может писать пользователям первым, зная только телефон. Пользователь должен сначала начать диалог с ботом (`/start`).
