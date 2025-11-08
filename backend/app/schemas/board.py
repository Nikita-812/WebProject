from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import Field

from .base import ORMModel


class ColumnBase(ORMModel):
    name: str = Field(min_length=1, max_length=120)
    order: int


class ColumnCreate(ORMModel):
    board_id: uuid.UUID
    name: str = Field(min_length=1, max_length=120)
    order: int | None = None


class ColumnUpdate(ORMModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    order: int | None = None


class ColumnRead(ColumnBase):
    id: uuid.UUID
    board_id: uuid.UUID


class CardSummary(ORMModel):
    id: uuid.UUID
    column_id: uuid.UUID
    title: str
    description: str | None = None
    labels: list[dict] | list[str]
    assignees: list[str]
    priority: str | None = None
    due_date: date | None = None
    position: int
    version: int
    created_at: datetime
    updated_at: datetime


class BoardSnapshot(ORMModel):
    board_id: uuid.UUID
    columns: list[ColumnRead]
    cards: list[CardSummary]
