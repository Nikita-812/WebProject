from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from .base import ORMModel


class MessageCreate(ORMModel):
    project_id: uuid.UUID
    content: str = Field(min_length=1, max_length=2000)


class MessageRead(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime
    user_display_name: str | None = None
