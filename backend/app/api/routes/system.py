from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.schemas.system import HealthStatus
from app.schemas.user import UserRead
from app.services.redis import get_redis

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthStatus)
async def health(db: AsyncSession = Depends(get_db)) -> HealthStatus:
    postgres_ok = False
    redis_ok = False

    try:
        await db.execute(text("SELECT 1"))
        postgres_ok = True
    except Exception:  # pragma: no cover - best effort
        postgres_ok = False

    try:
        redis = get_redis()
        await redis.ping()
        redis_ok = True
    except Exception:  # pragma: no cover
        redis_ok = False

    status_text = "ok" if postgres_ok and redis_ok else "degraded"
    return HealthStatus(status=status_text, postgres=postgres_ok, redis=redis_ok)


@router.get("/me", response_model=UserRead)
async def me(current_user=Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
