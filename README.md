# 🏨 Hotel Manager

Система управления отелем: бронирования, персонал, номерной фонд, уведомления.

**Backend**: FastAPI + SQLite | **Frontend**: React 18 + Vite + Ant Design 5

---

## ✨ Функционал

### 🏠 Номерной фонд
- Просмотр всех номеров с фильтрацией по статусу
- Управление типами: одноместный, двухместный, люкс
- Статусы: свободен, занят, **забронирован**, уборка, ремонт
- Клик на статус **«Забронирован»** — переходит к ближайшей брони в календаре
- Назначение сотрудников на номер (уборка / ремонт) прямо из интерфейса
- Статистика по каждому статусу в карточках-фильтрах

### 📅 Календарь бронирований
- Gantt-вид: номера × дни месяца
- Цветные полосы с именем гостя поверх дней
- Создание брони двумя кликами по ячейкам
- Редактирование и удаление броней
- Навигация по месяцам; кнопка «Сегодня»
- Автопрокрутка и подсветка нужного номера при переходе из раздела «Номера»

### 👥 Гости
- Учёт гостей с источником и комментарием
- Быстрое создание гостя прямо при создании брони
- История бронирований по гостю

### 👨‍💼 Сотрудники
- Управление персоналом: уборщики, ремонтники, администраторы
- Логин/пароль для входа в систему
- Telegram Username — для персональных уведомлений
- NextCloud Username — для уведомлений через NextCloud Talk
- Статус (активен / деактивирован)

### 🔔 Уведомления
Поддерживается **два параллельных канала**:
- **Telegram Bot** — личные уведомления и групповые логи назначений
- **NextCloud Talk Bot** — личные сообщения сотрудникам через NC Talk

Настройка каналов — через раздел «Настройки» (только для администраторов).

### ⚙️ Настройки
- Telegram: токен бота + ID группы
- NextCloud Talk: URL сервера, логин/пароль бота, token комнаты
- Доступно только администраторам

### 🔐 Авторизация
- JWT + HttpOnly Cookie
- Ролевой доступ: admin / cleaner / repair
- Автоматическая ротация токена при каждом запросе

---

## 🐳 Деплой через Docker (Рекомендуемый)

Проект полностью подготовлен для развёртывания через Docker. Бэкенд и фронтенд работают в изолированных контейнерах, общаясь через внутреннюю сеть. Nginx проксирует запросы и раздаёт статику, тем самым автоматически решая все возможные проблемы с CORS на продакшне.

### Быстрый запуск на сервере

1. **Клонируйте репозиторий** на сервер:
   ```bash
   git clone https://github.com/your-username/hotel2.git
   cd hotel2
   ```

2. **Настройте переменные окружения**:
   Скопируйте шаблон `.env.example` для бэкенда:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Внутри `backend/.env` обязательно укажите ваши `SECRET_KEY` и `TELEGRAM_TOKEN`.

3. **Запустите Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

4. **Создайте первого администратора** (выполняется внутри контейнера бэкенда):
   ```bash
   docker compose exec backend python create_admin.py
   ```

Приложение будет доступно по адресу `http://<IP_вашего_сервера>` (порт 80). База данных SQLite автоматически сохраняется в Docker Volume `hotel_data`.

---

## 💻 Локальный запуск

### Backend

```bash
cd backend

# Установить зависимости
pip install -r requirements.txt

# Применить миграции
python migrate.py

# Создать администратора (только 1 раз)
python create_admin.py

# Запустить
uvicorn main:app --reload --port 8000
```

> Swagger UI: http://localhost:8000/docs

### Frontend

```bash
cd frontend

npm install
npm run dev
```

> Приложение: http://localhost:5173

---

## 🗂 Структура проекта

```
hotel2/
├── docker-compose.yml       ← Оркестрация контейнеров
├── .dockerignore
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile           ← Сборка Python-контейнера
│   ├── .env.example         ← Шаблон переменных окружения
│   ├── main.py              ← FastAPI app, StaticFiles, middleware
│   ├── models.py            ← SQLAlchemy модели
│   ├── schemas.py           ← Pydantic схемы
│   ├── database.py          ← подключение к БД
│   ├── dependencies.py      ← JWT авторизация
│   ├── utils.py             ← вспомогательные функции
│   ├── telegram_bot.py      ← Telegram уведомления (aiogram)
│   ├── nextcloud_bot.py     ← NextCloud Talk уведомления (httpx)
│   ├── migrate.py           ← миграции БД
│   ├── create_admin.py      ← создание администратора
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py
│       ├── rooms.py
│       ├── employees.py
│       ├── guests.py
│       ├── bookings.py
│       ├── calendar.py
│       ├── assignments.py
│       └── settings.py
│
└── frontend/
    ├── Dockerfile           ← Сборка React/Nginx-контейнера
    ├── nginx.conf           ← Nginx прокси для раздачи UI и API
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── App.tsx
        ├── api/             ← axios клиент и типы
        ├── contexts/        ← AuthContext
        ├── layouts/         ← MainLayout (сайдбар, навигация)
        └── pages/
            ├── LoginPage
            ├── RoomsPage
            ├── CalendarPage
            ├── EmployeesPage
            ├── GuestsPage
            └── SettingsPage
```

---

## 🛠 Стек технологий

| Слой | Технологии |
|------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, SQLite |
| Auth | python-jose (JWT), bcrypt |
| Уведомления | aiogram (Telegram), httpx (NextCloud Talk) |
| Frontend | React 18, TypeScript, Vite, Ant Design 5, dayjs |
| Маршрутизация | react-router-dom v6 |
| HTTP клиент | axios |
| Деплой | Docker, Docker Compose, Nginx |
