from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from .user import UserRead


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class TokenPayload(BaseModel):
    sub: uuid.UUID
    exp: datetime
