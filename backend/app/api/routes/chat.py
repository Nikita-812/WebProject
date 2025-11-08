from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi_limiter.depends import RateLimiter
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Message
from app.schemas.chat import MessageCreate, MessageRead
from app.services.bus import broadcast
from app.utils.permissions import ensure_project_member

router = APIRouter(prefix="/projects", tags=["chat"])


@router.get("/{project_id}/messages", response_model=list[MessageRead])
async def get_messages(
    project_id: uuid.UUID,
    cursor: datetime | None = Query(default=None, description="ISO timestamp cursor"),
    limit: int = Query(default=50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await ensure_project_member(project_id, current_user, db)

    stmt = select(Message).where(Message.project_id == project_id).options(selectinload(Message.author))
    if cursor:
        stmt = stmt.where(Message.created_at < cursor)
    stmt = stmt.order_by(Message.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    messages = list(reversed(result.scalars().all()))
    return [
        MessageRead(
            id=message.id,
            project_id=message.project_id,
            user_id=message.user_id,
            content=message.content,
            created_at=message.created_at,
            user_display_name=message.author.display_name if message.author else None,
        )
        for message in messages
    ]


@router.post(
    "/{project_id}/messages",
    response_model=MessageRead,
    dependencies=[Depends(RateLimiter(times=5, seconds=10))],
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    project_id: uuid.UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Message:
    if payload.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project mismatch")

    await ensure_project_member(project_id, current_user, db)

    message = Message(project_id=project_id, user_id=current_user.id, content=payload.content)
    db.add(message)
    await db.commit()
    await db.refresh(message)
    await broadcast(
        "chat.message.created",
        {
            "id": str(message.id),
            "projectId": str(project_id),
            "userId": str(current_user.id),
            "text": message.content,
            "createdAt": message.created_at.isoformat(),
            "displayName": current_user.display_name,
        },
        room=f"project:{project_id}",
    )
    return MessageRead(
        id=message.id,
        project_id=message.project_id,
        user_id=message.user_id,
        content=message.content,
        created_at=message.created_at,
        user_display_name=current_user.display_name,
    )
