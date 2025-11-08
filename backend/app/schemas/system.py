from __future__ import annotations

from .base import ORMModel


class HealthStatus(ORMModel):
    status: str
    postgres: bool
    redis: bool
