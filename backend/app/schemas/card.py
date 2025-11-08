from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import Field

from .base import ORMModel


class CardCreate(ORMModel):
    project_id: uuid.UUID
    column_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    labels: list[dict] | list[str] = Field(default_factory=list)
    assignees: list[str] = Field(default_factory=list)
    priority: str | None = Field(default=None, pattern="^(low|medium|high)$")
    due_date: date | None = None
    position: int | None = None


class CardUpdate(ORMModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    labels: list[dict] | list[str] | None = None
    assignees: list[str] | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high)$")
    due_date: date | None = None
    version: int = Field(alias="clientVersion")


class CardMoveRequest(ORMModel):
    id: uuid.UUID
    from_column_id: uuid.UUID = Field(alias="fromColumnId")
    to_column_id: uuid.UUID = Field(alias="toColumnId")
    position: int
    client_version: int = Field(alias="clientVersion")


class CardRead(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID
    column_id: uuid.UUID
    title: str
    description: str | None
    labels: list[dict] | list[str]
    assignees: list[str]
    priority: str | None
    due_date: date | None
    position: int
    version: int
    created_at: datetime
    updated_at: datetime
