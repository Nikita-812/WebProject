from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from redis.asyncio import Redis

from app.core.config import settings

redis_client: Redis | None = None

def get_redis() -> Redis:
    if redis_client is None:
        raise RuntimeError("Redis client is not initialized")
    return redis_client


async def init_redis() -> None:
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
        await redis_client.ping()


async def close_redis() -> None:
    if redis_client is not None:
        await redis_client.close()


@asynccontextmanager
async def lifespan_redis():
    await init_redis()
    try:
        yield
    finally:
        await close_redis()
