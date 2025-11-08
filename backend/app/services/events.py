from __future__ import annotations

import uuid

from redis.asyncio import Redis


class EventDeduplicator:
    def __init__(self, redis: Redis, ttl_seconds: int = 120):
        self.redis = redis
        self.ttl = ttl_seconds

    async def mark_and_check(self, event_id: uuid.UUID) -> bool:
        key = f"event:{event_id}"
        added = await self.redis.setnx(key, "1")
        if added:
            await self.redis.expire(key, self.ttl)
            return False
        return True
