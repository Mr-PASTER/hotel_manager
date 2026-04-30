# Hotel Manager

A full-stack hotel management application built with React (frontend) and FastAPI (backend), served via Docker Compose.

---

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) >= 24
- [Docker Compose](https://docs.docker.com/compose/) >= 2.20

### 1. Clone and configure environment

```bash
cp .env.example .env
```

Open `.env` and replace all placeholder values — especially secrets and passwords:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Strong database password |
| `JWT_SECRET` | Min 32-char random string (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Separate random string for refresh tokens |
| `ENCRYPTION_KEY` | 32 hex characters = 16 bytes (`openssl rand -hex 16`) |
| `APP_PORT` | Host port the app listens on (default `80`) |

### 2. Build and run

```bash
docker compose up -d --build
```

The app will be available at **http://localhost** (or `http://localhost:APP_PORT`).

Services start in dependency order:
1. `postgres` → waits until healthy
2. `backend` → waits until postgres is healthy
3. `frontend` → waits until backend is healthy

### 3. View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

### 4. Stop

```bash
docker compose down          # keep database volume
docker compose down -v       # also delete database volume
```

---

## Production with HTTPS

External HTTPS termination is handled by **nginx on the host** (or Cloudflare). The Docker stack exposes plain HTTP on the configured `APP_PORT`.

### Install Certbot (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d hotel.mpda.ru
```

### Host nginx reverse-proxy config

Create `/etc/nginx/sites-available/hotel.mpda.ru`:

```nginx
server {
    listen 80;
    server_name hotel.mpda.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hotel.mpda.ru;

    ssl_certificate /etc/letsencrypt/live/hotel.mpda.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hotel.mpda.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/hotel.mpda.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> **Note:** If `APP_PORT` in `.env` is not `80`, update `proxy_pass http://127.0.0.1:<APP_PORT>` accordingly.

---

## Development

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set env vars (or create a local .env and load it)
export DATABASE_URL=postgresql+asyncpg://hotel:hotel_secret@localhost:5432/hotel_manager
export JWT_SECRET=dev_secret_32_chars_minimum_here
export JWT_REFRESH_SECRET=dev_refresh_secret
export ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

python run.py
```

Backend runs at **http://localhost:3000**. Interactive API docs: **http://localhost:3000/docs**

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs at **http://localhost:5173**.

> The Vite dev proxy (configured in `vite.config.ts`) should forward `/api` requests to `http://localhost:3000`.

### Local database (Docker only)

```bash
docker compose up postgres -d
```

---

## Default Credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |

> **Change the admin password immediately after first login in production.**

---

## Project Structure

```
.
├── backend/                  # FastAPI application
│   ├── app/                  # Application modules
│   ├── alembic/              # Database migrations
│   ├── requirements.txt
│   ├── run.py                # Uvicorn entry point
│   └── Dockerfile
├── frontend/                 # React + Vite application
│   ├── src/
│   ├── nginx.conf            # nginx config for production container
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example              # Environment variable template
└── README.md
```

## Container Architecture

```
Host (port 80/443)
    └── [host nginx / Cloudflare] — SSL termination
            └── hotel_frontend (nginx, port 80)
                    ├── /           → serves React build (SPA)
                    ├── /assets/*   → static files, 1y cache
                    └── /api/*      → proxy → hotel_backend:3000
                                            └── hotel_postgres:5432
```
