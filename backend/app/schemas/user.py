from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from .base import ORMModel


class UserBase(ORMModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=120)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRead(UserBase):
    id: uuid.UUID
    created_at: datetime


class UserLogin(ORMModel):
    email: EmailStr
    password: str


class UserPublic(UserRead):
    pass
