from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from .base import ORMModel


class ProjectCreate(ORMModel):
    name: str = Field(min_length=1, max_length=200)


class ProjectRead(ORMModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    created_at: datetime


class ProjectList(ORMModel):
    projects: list[ProjectRead]
