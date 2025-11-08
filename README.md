# Kanban Realtime MVP

Full-stack шаблон «канбан + чат» с FastAPI, SQLAlchemy 2.0, PostgreSQL, Redis и SPA на Vite + React/TypeScript. Проект собирает REST API, WebSocket (Socket.IO), alembic-миграции, JWT-аутентификацию и базовый фронтенд для MVP.

## Архитектура

```
[Vite SPA]  <--HTTP/WS-->  [FastAPI + python-socketio (ASGI)]
                                          |-- SQLAlchemy 2.x + Alembic --> PostgreSQL
                                          \-- Redis (rate limit, pub/sub)
```

- **FastAPI**: REST API (`/api/v1`) + Swagger `/docs`, JWT авторизация, Pydantic v2 DTO.
- **Socket.IO namespace `/ws`**: события для доски и чата с ACK + антидублированием по `eventId` через Redis.
- **PostgreSQL**: состояние проектов, карточек, сообщений, аудита. Alembic миграция `0001_initial` повторяет заданную ERD.
- **Redis**: `fastapi-limiter` (rate limit API/чата) + хранение последних `eventId` для WebSocket.
- **Frontend (Vite React TS)**: минимальный UI с авторизацией, списком проектов, доской и чат-панелью, live-обновлениями через socket.io-client + Zustand store.

## Структура репозитория

```
backend/
  app/
    api/        # роутеры FastAPI (auth, projects, board, cards, chat, files, system)
    core/       # Settings (Pydantic), конфиг
    db/         # engine + Declarative Base
    models/     # SQLAlchemy сущности
    schemas/    # Pydantic DTO
    services/   # security, redis, broadcast bus, deduplicator
    websocket/  # socket.io обработчики
  alembic/      # миграции
  pyproject.toml
frontend/
  src/
    api/        # HTTP-клиент
    components/ # Auth, Board, Chat, Sidebar
    hooks/      # useRealtime (Socket.IO)
    lib/        # socket.io клиент
    store/      # Zustand (auth, board)
    views/      # Dashboard
  package.json
storage/uploads/ # локальные файлы (в .gitignore)
```

## Быстрый старт (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

Контейнеры:
- `backend`: http://localhost:8000 (`/api/v1`, Swagger `/docs`, Socket.IO на `/socket.io`, namespace `/ws`).
- `frontend`: http://localhost:5173 (Vite dev server) с переменными `VITE_API_URL` и `VITE_WS_URL`.
- `db`: PostgreSQL `kanban/kanban` на `5432`.
- `redis`: Redis 7 на `6379`.

## Локальная разработка

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp ../.env.example .env  # скорректируй URL БД/Redis
alembic upgrade head
uvicorn app.main:socket_app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # при необходимости
npm run dev -- --host
```

## Ключевые HTTP эндпоинты (`/api/v1`)
- `POST /auth/register`, `POST /auth/login` → JWT + профиль.
- `GET /projects`, `POST /projects`, `GET /projects/{id}` (создание доски + колонок «Todo/In Progress/Done» автоматически).
- `GET /projects/{id}/board` → батч колонок+карточек.
- `POST /columns`, `PATCH /columns/{id}`.
- `POST /cards`, `GET /cards/{id}`, `PATCH /cards/{id}`, `POST /cards/{id}/move` (версионность `cards.version`, 409 при конфликте).
- Чат: `GET/POST /projects/{id}/messages` (POST ограничен rate limit 5/10s).
- Файлы: `POST /files?project_id=...` (10 MB, MIME-check) + `GET /files/{id}` с проверкой участника.
- Служебные: `GET /health`, `GET /me`.

## WebSocket / Socket.IO (`namespace /ws`)
- `join_room { projectId }` / `leave_room` → комнаты `project:{id}`.
- `card.create | card.update | card.move` — сервер валидирует права, версию, рассылает `card.created/updated/moved`.
- `chat.message { tempId, text }` → ACK `{ id, createdAt }` + broadcast `chat.message.created`.
- `chat.typing { projectId, userId }` → широковещательный индикатор.
- Любое событие может включать `eventId` (UUID) для защиты от повторной отправки (Redis TTL 120s).

## Безопасность и observability
- JWT (HS256, короткий TTL) + `OAuth2PasswordBearer` зависимость.
- Пароли через `argon2` (passlib).
- CORS whitelist (`BACKEND_CORS_ORIGINS`).
- Rate limit через `fastapi-limiter` (Redis) на шумные эндпоинты.
- DTO валидация Pydantic (ограничения по длине, mime/types); DOMPurify на фронте.
- Логи FastAPI + заготовка для structlog/loguru.

## Следующие шаги
- Настроить CI (ruff, pytest, frontend lint).
- Реализовать файловое хранилище (S3/MinIO) вместо локального `storage/uploads`.
- Добавить refresh-токены, политику ролей (`members.role`), уведомления аудита (`events_audit`).
- Покрыть доменные сервисы тестами (pytest + httpx AsyncClient) и e2e (Playwright).
