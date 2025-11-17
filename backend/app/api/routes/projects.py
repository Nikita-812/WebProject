from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Board, Column, Member, Project, User
from app.schemas.project import ProjectCreate, ProjectRead

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
) -> list[Project]:
    stmt = (
        select(Project)
        .outerjoin(Member, Member.project_id == Project.id)
        .where(or_(Project.owner_id == current_user.id, Member.user_id == current_user.id))
        .distinct()
        .order_by(Project.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Project:
    project = Project(name=payload.name, owner_id=current_user.id)
    db.add(project)
    await db.flush()

    db.add(Member(project_id=project.id, user_id=current_user.id, role="owner"))
    board = Board(project_id=project.id)
    db.add(board)
    await db.flush()

    default_columns = ["Todo", "In Progress", "Done"]
    for index, name in enumerate(default_columns):
        db.add(Column(board_id=board.id, name=name, order=index))

    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Project:
    stmt = (
        select(Project)
        .outerjoin(Member, Member.project_id == Project.id)
        .where(Project.id == project_id)
        .where(or_(Project.owner_id == current_user.id, Member.user_id == current_user.id))
        .distinct()
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project

@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
async def add_user_to_project(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Добавить пользователя к проекту. Только владелец проекта может добавлять участников."""
    
    # Проверяем, что текущий пользователь - владелец проекта
    project = await db.scalar(select(Project).where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only project owner can add members"
        )
    
    # Проверяем, что пользователь существует
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Проверяем, что пользователь уже не член проекта
    existing_member = await db.scalar(
        select(Member).where(
            Member.project_id == project_id,
            Member.user_id == user_id
        )
    )
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User is already a member of the project"
        )

    # Добавляем новое членство
    new_member = Member(project_id=project_id, user_id=user_id, role="member")
    db.add(new_member)
    await db.commit()
    
    return {"message": "User added to project successfully", "user_id": user_id} 