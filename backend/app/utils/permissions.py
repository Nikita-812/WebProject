from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Member, Project, User


async def ensure_project_member(
    project_id: uuid.UUID, user: User, db: AsyncSession, enforce_owner: bool = False
) -> Project:
    query = select(Project).where(Project.id == project_id)
    if enforce_owner:
        query = query.where(Project.owner_id == user.id)
    else:
        query = query.where(
            or_(
                Project.owner_id == user.id,
                Project.id.in_(
                    select(Member.project_id).where(Member.user_id == user.id)
                ),
            )
        )

    project = await db.scalar(query)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
