FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip
COPY pyproject.toml ./ 
COPY README.md ./README.md
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
RUN pip install --no-cache-dir .

# Устанавливаем утилиту для ожидания базы данных
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

EXPOSE 8000

# Создаем скрипт запуска с ожиданием БД
CMD sh -c "until pg_isready -h db -p 5432; do echo 'Waiting for database...'; sleep 2; done; echo 'Database is ready!'; alembic upgrade head; uvicorn app.main:socket_app --host 0.0.0.0 --port 8000"