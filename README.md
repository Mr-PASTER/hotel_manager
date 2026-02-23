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

## 🚀 Деплой на Render

### Быстрый деплой

1. Создайте репозиторий на GitHub и загрузите проект
2. Зайдите на [render.com](https://render.com) → **New → Blueprint**
3. Укажите URL репозитория — Render автоматически прочитает `render.yaml`
4. Создайте первого администратора через **Shell** в Render-дашборде:
   ```bash
   python create_admin.py
   ```

### Переменные окружения на Render

| Переменная | Описание |
|-----------|---------|
| `SECRET_KEY` | JWT секрет (генерируется автоматически) |
| `DATABASE_URL` | `sqlite:////app/data/hotel.db` (persistent disk) |
| `RENDER` | `true` (устанавливается автоматически) |

### Persistent Disk
В `render.yaml` уже настроен диск 1 ГБ (`/app/data`). Установите переменную:
```
DATABASE_URL=sqlite:////app/data/hotel.db
```
Это сохранит БД между деплоями.

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
├── render.yaml              ← конфигурация деплоя Render
├── .gitignore
├── README.md
│
├── backend/
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
│   ├── start.sh             ← скрипт запуска для Render
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
| Деплой | Render (Web Service + Persistent Disk) |
