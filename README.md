# 🏨 Hotel Manager v2

Система управления отелем: бронирования, номерной фонд, статусы уборки, персонал, уведомления.

**Backend**: FastAPI + SQLite | **Frontend**: React 18 + Vite + Ant Design 5

---

## ✨ Функционал

### 🏠 Номерной фонд
- Просмотр всех номеров с фильтрацией по статусу
- Управление типами: одноместный, двухместный, люкс
- Статусы: **свободен**, **занят**, **забронирован**
- Столбец **Чистота** — показывает актуальный статус уборки каждого номера
- Клик на статус «Забронирован» — переходит к ближайшей брони в календаре
- Статистика в карточках-фильтрах

### 🧹 Панель статуса уборки (`/room-status`)
- Список всех номеров с тумблерами **Чисто / Грязно**
- Счётчики чистых и грязных номеров в реальном времени
- Поиск по номеру
- Кнопка **«Сохранить»** — массовое сохранение изменений
- Кнопка **«Отправить в чат»** — формирует отчёт по шаблону и отправляет в NextCloud Talk
- Доступна всем авторизованным пользователям (admin + moderator)

### 📅 Календарь бронирований
- Gantt-вид: номера × дни месяца
- Цветные полосы с именем гостя поверх дней
- Создание брони двумя кликами по ячейкам
- Редактирование и удаление броней
- Навигация по месяцам; кнопка «Сегодня»

### 👥 Гости / 👨‍💼 Сотрудники / ⚙️ Настройки
- Учёт гостей, ролевой доступ, интеграция NextCloud Talk

---

## 🐳 Деплой через Docker (Рекомендуемый)

### Первый деплой на HTTPS-сервере

> ⚠️ Предполагается, что на сервере уже настроен внешний reverse-proxy (Nginx/Caddy) с SSL-сертификатом, проксирующий `https://hotel.mpda.ru` → `http://127.0.0.1:80`.

**1. Клонируйте репозиторий:**
```bash
git clone https://github.com/your-username/hotel2.git
cd hotel2
```

**2. Настройте переменные окружения `backend/.env`:**
```env
# ОБЯЗАТЕЛЬНО: замените на случайный ключ (минимум 32 символа)
SECRET_KEY=замените-на-случайный-ключ-минимум-32-символа

# Путь к SQLite БД внутри контейнера (не менять)
DATABASE_URL=sqlite:////app/data/hotel.db

# Для HTTPS: cookie будет secure=True + samesite=none
HTTPS_ENABLED=true

# Ваш домен — добавляется в список CORS
FRONTEND_URL=https://hotel.mpda.ru
```

**3. Соберите и запустите:**
```bash
docker compose up -d --build
```

**4. Создайте первого администратора:**
```bash
docker compose exec backend python create_admin.py
```

**5. Готово!** Откройте `https://hotel.mpda.ru` в браузере.

> 💾 База данных SQLite хранится в Docker Volume `hotel_data` и **переживает** перезапуск и пересборку контейнеров.

---

### 🔄 Обновление сервера (без потери данных)

```bash
# Зайти на сервер
ssh user@hotel.mpda.ru

# Перейти в директорию проекта
cd /path/to/hotel2

# Получить изменения
git pull

# Пересобрать и перезапустить (volume НЕ трогаем!)
docker compose down
docker compose build --no-cache
docker compose up -d
```

> ❌ **НИКОГДА** не используй `docker compose down -v` — это удалит volume с базой данных!

---

### 📋 Полезные команды

```bash
# Логи бэкенда (самое важное при отладке)
docker compose logs backend --tail=100 -f

# Логи фронтенда (nginx)
docker compose logs frontend --tail=50

# Состояние контейнеров
docker compose ps

# Перезапустить только бэкенд
docker compose restart backend

# Создать нового администратора
docker compose exec backend python create_admin.py

# Бэкап БД
docker compose exec backend sqlite3 /app/data/hotel.db ".backup /app/data/hotel_backup.db"
docker compose cp backend:/app/data/hotel_backup.db ./hotel_backup.db
```

### Открытые порты

| Порт | Сервис | Описание |
|------|--------|----------|
| `80` | Nginx → Frontend | Веб-интерфейс + проксирование `/api/*` |

> Порт 8000 (backend) закрыт и доступен **только внутри** Docker-сети.

---

## 💻 Локальный запуск (разработка)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
python migrate.py
python create_admin.py
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
> Vite проксирует `/api/*` → `http://localhost:8000`

---

## 🗂 Структура проекта

```
hotel2/
├── docker-compose.yml        ← Оркестрация контейнеров
├── .dockerignore
├── README.md
│
├── backend/
│   ├── Dockerfile            ← python:3.12-slim → entrypoint.sh
│   ├── entrypoint.sh         ← Запуск: mkdir → migrate → uvicorn
│   ├── .env                  ← Переменные окружения (не в git!)
│   ├── main.py               ← FastAPI app, CORS, роутеры
│   ├── models.py             ← SQLAlchemy ORM модели
│   ├── schemas.py            ← Pydantic схемы (v2)
│   ├── database.py           ← SQLite подключение
│   ├── dependencies.py       ← JWT авторизация
│   ├── migrate.py            ← SQLite миграции (безопасные)
│   ├── create_admin.py       ← CLI создание администратора
│   ├── requirements.txt      ← Зафиксированные версии
│   └── routers/              ← /api/auth, /rooms, /bookings, ...
│
└── frontend/
    ├── Dockerfile            ← node:20 build → nginx:alpine
    ├── nginx.conf            ← SPA routing + /api/ прокси
    ├── vite.config.ts
    └── src/
        ├── api/client.ts     ← Axios + withCredentials: true
        ├── contexts/AuthContext.tsx
        └── pages/            ← RoomsPage, CalendarPage, ...
```

---

## 🔑 Переменные окружения (`backend/.env`)

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `SECRET_KEY` | Ключ подписи JWT (**обязательно сменить!**) | `super-secret-32+chars` |
| `DATABASE_URL` | Путь к SQLite | `sqlite:////app/data/hotel.db` |
| `HTTPS_ENABLED` | `true` для HTTPS (secure cookie) | `true` |
| `FRONTEND_URL` | URL фронтенда для CORS | `https://hotel.mpda.ru` |

> Настройки NextCloud Talk задаются через веб-интерфейс → **Настройки**.

---

## 🛠 Стек технологий

| Слой | Технологии |
|------|-----------|
| Backend | Python 3.12, FastAPI 0.110, SQLAlchemy 2, Pydantic v2, SQLite |
| Auth | python-jose (JWT HS256), bcrypt, HttpOnly Cookie (secure) |
| Frontend | React 18, TypeScript, Vite, Ant Design 5, Axios |
| Деплой | Docker, Docker Compose, Nginx (alpine) |


## ✨ Функционал

### 🏠 Номерной фонд
- Просмотр всех номеров с фильтрацией по статусу
- Управление типами: одноместный, двухместный, люкс
- Статусы: **свободен**, **занят**, **забронирован**
- Столбец **Чистота** — показывает актуальный статус уборки каждого номера
- Клик на статус «Забронирован» — переходит к ближайшей брони в календаре
- Статистика в карточках-фильтрах

### 🧹 Панель статуса уборки (`/room-status`)
- Список всех номеров с тумблерами **Чисто / Грязно**
- Счётчики чистых и грязных номеров в реальном времени
- Поиск по номеру
- Кнопка **«Сохранить»** — массовое сохранение изменений
- Кнопка **«Отправить в чат»** — формирует отчёт по шаблону и отправляет в NextCloud Talk
- Подсветка изменённых строк, кнопка scroll-to-top
- Доступна всем авторизованным пользователям (admin + moderator)

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
- Роли: **Администратор** и **Модератор**
- Логин / пароль для входа в систему
- Автогенерация учётных данных с транслитерацией ФИО
- NextCloud Username — для уведомлений через NextCloud Talk
- Статус (активен / деактивирован)
- Раздел доступен только администраторам

### 🔔 Уведомления — NextCloud Talk
- Отправка логов об изменении статусов номеров
- Отправка логов об изменении сотрудников
- Ручная отправка отчёта о чистоте номеров через кнопку «Отправить в чат»
- Шаблон сообщения настраивается через раздел «Настройки»

### ⚙️ Настройки _(только для администраторов)_
- NextCloud Talk: URL сервера, логин/пароль бота, token комнаты
- Включение/выключение автоматических уведомлений
- **Редактор шаблона** отчёта о чистоте с переменными:
  - `{clean_rooms}` — список чистых номеров
  - `{dirty_rooms}` — список грязных номеров
  - `{clean_count}` / `{dirty_count}` / `{total}`

### 🔐 Авторизация
- JWT + HttpOnly Cookie
- Ролевой доступ: **admin** / **moderator**
- Администратор: полный доступ ко всем разделам
- Модератор: доступ к номерному фонду и панели уборки
- Автоматическая ротация токена при каждом запросе

---

## 🐳 Деплой через Docker (Рекомендуемый)

Бэкенд и фронтенд работают в изолированных контейнерах, общаясь через внутреннюю сеть `hotel_net`. Nginx проксирует `/api/*` на FastAPI и раздаёт React SPA статику. Миграции БД применяются **автоматически** при каждом старте контейнера.

### Быстрый запуск на сервере

**1. Клонируйте репозиторий:**
```bash
git clone https://github.com/your-username/hotel2.git
cd hotel2
```

**2. Настройте переменные окружения:**
```bash
cp backend/.env.example backend/.env
```
Отредактируйте `backend/.env`:
```env
SECRET_KEY=замените-на-случайный-ключ-минимум-32-символа
DATABASE_URL=sqlite:////app/data/hotel.db
# FRONTEND_URL=http://ваш-домен.com   # опционально
```

**3. Соберите и запустите:**
```bash
docker compose up -d --build
```
> При первом запуске Docker скачает образы и соберёт контейнеры. Миграции применятся автоматически.

**4. Создайте первого администратора:**
```bash
docker compose exec backend python create_admin.py
```

**5. Готово!** Откройте `http://<IP_сервера>` в браузере.

> База данных SQLite сохраняется в Docker Volume `hotel_data` и переживает перезапуск контейнеров.

### Управление

```bash
# Остановить
docker compose down

# Просмотр логов
docker compose logs -f backend
docker compose logs -f frontend

# Перезапустить только backend
docker compose restart backend

# Обновить до новой версии
git pull
docker compose up -d --build
```

### Открытые порты

| Порт | Сервис | Описание |
|------|--------|----------|
| `80` | Nginx → Frontend | Веб-интерфейс и проксирование API |

> Порт 8000 (backend) закрыт и доступен **только внутри** Docker-сети.

---

## 💻 Локальный запуск (разработка)

### Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Установить зависимости
pip install -r requirements.txt

# Применить миграции БД
python migrate.py

# Создать администратора (только один раз)
python create_admin.py

# Запустить сервер разработки
uvicorn main:app --reload --port 8000
```

> Swagger UI: http://localhost:8000/docs  
> ReDoc: http://localhost:8000/redoc

### Frontend

```bash
cd frontend

npm install
npm run dev
```

> Приложение: http://localhost:5173

Vite автоматически проксирует `/api/*` на `http://localhost:8000` через `vite.config.ts`.

---

## 🗂 Структура проекта

```
hotel2/
├── docker-compose.yml        ← Оркестрация контейнеров
├── .dockerignore
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile            ← python:3.12-slim → migrate → uvicorn
│   ├── .env.example          ← Шаблон переменных окружения
│   ├── main.py               ← FastAPI app, CORS, роутеры
│   ├── models.py             ← SQLAlchemy ORM модели
│   ├── schemas.py            ← Pydantic схемы (v2)
│   ├── database.py           ← SQLite подключение (DATABASE_URL из env)
│   ├── dependencies.py       ← JWT авторизация, get_current_user
│   ├── utils.py              ← get_config() и хелперы
│   ├── nextcloud_bot.py      ← NextCloud Talk уведомления (httpx)
│   ├── telegram_bot.py       ← Заглушка (Telegram отключён)
│   ├── max_bot.py            ← Заглушка (MAX отключён)
│   ├── migrate.py            ← Миграции SQLite (читает DATABASE_URL)
│   ├── create_admin.py       ← CLI создание администратора
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py           ← /api/auth/* — логин, токен
│       ├── rooms.py          ← /api/rooms/* + /send-status-report
│       ├── employees.py      ← /api/employees/*
│       ├── guests.py         ← /api/guests/*
│       ├── bookings.py       ← /api/bookings/*
│       ├── calendar.py       ← /api/calendar/*
│       └── settings.py       ← /api/settings/*
│
└── frontend/
    ├── Dockerfile            ← node:20 build → nginx:alpine
    ├── nginx.conf            ← SPA routing + /api/ прокси на backend
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── App.tsx           ← роуты, ConfigProvider (тёмная тема)
        ├── api/              ← axios клиент + typed API methods
        │   ├── client.ts
        │   ├── rooms.ts
        │   ├── employees.ts
        │   ├── bookings.ts
        │   └── guests.ts
        ├── contexts/         ← AuthContext (JWT + user state)
        ├── layouts/          ← MainLayout (сайдбар, навигация)
        └── pages/
            ├── LoginPage.tsx
            ├── RoomsPage.tsx       ← Номерной фонд
            ├── RoomStatusPage.tsx  ← Панель уборки (новая)
            ├── CalendarPage.tsx    ← Gantt-календарь бронирований
            ├── EmployeesPage.tsx   ← Управление сотрудниками
            ├── GuestsPage.tsx      ← Картотека гостей
            └── SettingsPage.tsx    ← NC Talk + шаблон отчёта
```

---

## 🛠 Стек технологий

| Слой | Технологии |
|------|-----------|
| Backend | Python 3.12, FastAPI 0.110, SQLAlchemy 2, Pydantic v2, SQLite |
| Auth | python-jose (JWT HS256), bcrypt, HttpOnly Cookie |
| Уведомления | httpx (NextCloud Talk REST API) |
| Frontend | React 18, TypeScript, Vite, Ant Design 5, dayjs |
| Маршрутизация | react-router-dom v6 |
| HTTP клиент | axios |
| Деплой | Docker, Docker Compose, Nginx (alpine) |

---

## 🔑 Переменные окружения (`backend/.env`)

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `SECRET_KEY` | Ключ подписи JWT (**обязательно сменить!**) | `super-secret-32+chars` |
| `DATABASE_URL` | Путь к SQLite базе данных | `sqlite:////app/data/hotel.db` |
| `FRONTEND_URL` | URL фронтенда для CORS (опционально) | `http://195.10.10.1` |

> Все настройки чат-интеграции (NC Talk) задаются через веб-интерфейс в разделе **Настройки**.
