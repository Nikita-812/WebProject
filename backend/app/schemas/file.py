from __future__ import annotations

import uuid
from datetime import datetime

from .base import ORMModel


class FileRead(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID | None
    path: str
    mime: str
    size: int
    created_at: datetime
