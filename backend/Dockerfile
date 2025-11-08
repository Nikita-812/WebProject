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

EXPOSE 8000
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000"]
