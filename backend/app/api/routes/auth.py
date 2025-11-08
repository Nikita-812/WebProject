from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models import User
from app.schemas.auth import Token
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.services.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    exists = await db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    user = User(email=payload.email, display_name=payload.display_name, password_hash=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)) -> Token:
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(str(user.id))
    return Token(access_token=access_token, user=UserRead.model_validate(user))
