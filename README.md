# Hotel Manager

Полнофункциональная система управления отелем: бронирование номеров, контроль статуса уборки, управление персоналом и уведомления в Nextcloud Talk.

---

## Стек технологий

| Слой | Технологии |
|---|---|
| **Фронтенд** | React 19, TypeScript, Zustand, Tailwind CSS, Vite |
| **Бэкенд** | Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| **База данных** | PostgreSQL 15 |
| **Аутентификация** | JWT (access 15 мин + refresh 7 дней, httpOnly cookie) |
| **Безопасность** | bcrypt (rounds=12), AES-256-CBC для хранения токена бота |
| **Инфраструктура** | Docker, Docker Compose, nginx |

---

## Возможности

- **Управление номерами** — создание, редактирование, удаление, фильтрация по этажам
- **Статус уборки** — переключение `clean` / `dirty` с автоматическими уведомлениями
- **Календарь бронирований** — визуальная сетка, проверка пересечений, управление гостями
- **Управление персоналом** — роли `admin` / `moderator`, сброс паролей
- **Настройки Nextcloud Talk** — шаблоны уведомлений, тест подключения
- **Тёмная / светлая тема**
- **Rate limiting** — 20 запросов/сек на IP

---

## Быстрый старт (Docker)

### Требования

- [Docker](https://docs.docker.com/get-docker/) >= 24
- [Docker Compose](https://docs.docker.com/compose/) >= 2.20

### 1. Настройка окружения

```bash
cp .env.example .env
```

Откройте `.env` и заполните все значения:

| Переменная | Описание |
|---|---|
| `POSTGRES_USER` | Пользователь БД (по умолчанию `hotel`) |
| `POSTGRES_PASSWORD` | **Сильный** пароль БД |
| `POSTGRES_DB` | Имя базы данных (по умолчанию `hotel_manager`) |
| `JWT_SECRET` | Случайная строка ≥ 32 символов |
| `JWT_REFRESH_SECRET` | Отдельная случайная строка ≥ 32 символов |
| `ENCRYPTION_KEY` | Ровно 32 hex-символа (16 байт) |
| `APP_PORT` | Порт на хосте (по умолчанию `80`) |

Генерация безопасных секретов:

```bash
openssl rand -hex 32   # для JWT_SECRET и JWT_REFRESH_SECRET
openssl rand -hex 16   # для ENCRYPTION_KEY
```

### 2. Сборка и запуск

```bash
docker compose up -d --build
```

Контейнеры поднимаются в правильном порядке:
1. `hotel_postgres` — ждёт healthcheck `pg_isready`
2. `hotel_backend` — ждёт готовности postgres
3. `hotel_frontend` — ждёт готовности backend

### 3. Создание первого администратора

База данных при первом запуске пустая. Создайте администратора:

```bash
docker compose exec backend python create_admin.py
```

Скрипт запросит логин, имя и пароль (ввод пароля скрыт):

```
══════════════════════════════════════════════════
  Hotel Manager — Создание администратора
══════════════════════════════════════════════════

  Заполните данные нового администратора:

  Логин: admin
  Имя (для отображения) [admin]: Иван Петров
  Пароль (минимум 8 символов):
  Повтор пароля:

──────────────────────────────────────────────────
  ✔  Администратор успешно создан!

     Логин : admin
     Имя   : Иван Петров
     Роль  : admin
──────────────────────────────────────────────────
```

Дополнительные флаги:

```bash
# Передать логин и имя сразу (пароль всё равно запросится)
docker compose exec backend python create_admin.py --login admin --name "Иван Петров"

# Создать ещё одного администратора, если уже существуют
docker compose exec backend python create_admin.py --force
```

### 4. Проверка работы

После запуска приложение доступно по адресу **http://localhost** (или `http://localhost:APP_PORT`).

```bash
# Логи всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend

# Остановка (данные сохраняются)
docker compose down

# Остановка с удалением базы данных
docker compose down -v
```

---

## Деплой с HTTPS

HTTPS-терминация выполняется **nginx на хосте** (или Cloudflare). Docker-стек отдаёт HTTP на сконфигурированном `APP_PORT`.

### Установка Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d hotel.mpda.ru
```

### Конфиг nginx на хосте

Создайте `/etc/nginx/sites-available/hotel.mpda.ru`:

```nginx
server {
    listen 80;
    server_name hotel.mpda.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hotel.mpda.ru;

    ssl_certificate     /etc/letsencrypt/live/hotel.mpda.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hotel.mpda.ru/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
```

> Если `APP_PORT` в `.env` не `80`, замените `127.0.0.1:80` на `127.0.0.1:<APP_PORT>`.

Активация:

```bash
sudo ln -s /etc/nginx/sites-available/hotel.mpda.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Разработка

### Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Создайте backend/.env на основе примера
cp ../.env.example .env
# Отредактируйте DATABASE_URL и секреты под локальную БД

python run.py
```

- API: **http://localhost:3000**
- Swagger UI: **http://localhost:3000/docs**
- ReDoc: **http://localhost:3000/redoc**

Создание первого администратора локально:

```bash
python create_admin.py
```

Локальная БД через Docker (без поднятия всего стека):

```bash
docker compose up postgres -d
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev-сервер: **http://localhost:5173**

Vite автоматически проксирует `/api/*` → `http://localhost:3000` (настроено в `vite.config.ts`).

---

## API

Полная документация доступна в Swagger UI по адресу `/docs` после запуска бэкенда.

| Группа | Метод | Путь | Доступ |
|---|---|---|---|
| **Auth** | POST | `/api/auth/login` | Публичный |
| | POST | `/api/auth/refresh` | Публичный |
| | POST | `/api/auth/logout` | Авторизованный |
| | GET | `/api/auth/me` | Авторизованный |
| **Rooms** | GET | `/api/rooms` | Все |
| | POST | `/api/rooms` | admin |
| | PATCH | `/api/rooms/:id` | admin |
| | DELETE | `/api/rooms/:id` | admin |
| | PATCH | `/api/rooms/:id/status` | admin, moderator |
| **Bookings** | GET | `/api/bookings` | admin |
| | GET | `/api/bookings/:id` | admin |
| | POST | `/api/bookings` | admin |
| | PATCH | `/api/bookings/:id` | admin |
| | DELETE | `/api/bookings/:id` | admin |
| **Staff** | GET | `/api/staff` | admin |
| | POST | `/api/staff` | admin |
| | PATCH | `/api/staff/:id` | admin |
| | DELETE | `/api/staff/:id` | admin |
| | POST | `/api/staff/:id/reset-password` | admin |
| **Settings** | GET | `/api/settings` | admin |
| | PATCH | `/api/settings` | admin |
| | GET | `/api/settings/templates` | admin |
| | POST | `/api/settings/templates` | admin |
| | PATCH | `/api/settings/templates/:id` | admin |
| | DELETE | `/api/settings/templates/:id` | admin |
| | POST | `/api/settings/test-notification` | admin |
| **Notifications** | POST | `/api/notifications/send` | admin, moderator |

---

## Структура проекта

```
.
├── backend/
│   ├── app/
│   │   ├── api/              # Роутеры: auth, rooms, bookings, staff, settings, notifications
│   │   ├── core/             # config.py, database.py, security.py
│   │   ├── models/           # SQLAlchemy-модели
│   │   ├── schemas/          # Pydantic-схемы (DTO)
│   │   └── main.py           # FastAPI app, lifespan, middleware
│   ├── alembic/              # Миграции базы данных
│   ├── create_admin.py       # CLI-скрипт создания администратора
│   ├── run.py                # Точка входа Uvicorn
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/              # HTTP-клиент (fetch + авто-рефреш токена)
│   │   ├── components/       # React-компоненты по модулям
│   │   ├── store/            # Zustand-сторы (auth, rooms, bookings, settings, staff)
│   │   └── types/            # TypeScript-типы
│   ├── nginx.conf            # nginx-конфиг для продакшн-контейнера
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Архитектура контейнеров

```
Интернет
    └── Хост-nginx / Cloudflare  (SSL-терминация, 443 → 80)
            └── hotel_frontend   (nginx, порт 80)
                    ├── /            → React SPA (статика, кэш 1 год)
                    └── /api/*       → hotel_backend:3000 (proxy_pass)
                                             └── hotel_postgres:5432
```

Все три сервиса общаются через внутреннюю Docker-сеть. Наружу пробрасывается только порт `APP_PORT` фронтенда.
