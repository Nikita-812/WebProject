from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Board, Column
from app.schemas.board import ColumnCreate, ColumnRead, ColumnUpdate
from app.utils.permissions import ensure_project_member
from app.services.bus import broadcast

router = APIRouter(prefix="/columns", tags=["columns"])


@router.post("", response_model=ColumnRead, status_code=status.HTTP_201_CREATED)
async def create_column(
    payload: ColumnCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Column:
    board = await db.scalar(select(Board).where(Board.id == payload.board_id))
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    await ensure_project_member(board.project_id, current_user, db)

    max_order = await db.scalar(
        select(func.max(Column.order)).where(Column.board_id == board.id)
    )
    order_value = payload.order if payload.order is not None else (max_order or -1) + 1
    column = Column(board_id=board.id, name=payload.name, order=order_value)
    db.add(column)
    await db.commit()
    await db.refresh(column)
    return column


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    column_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> None:
    column = await db.scalar(select(Column).where(Column.id == column_id))
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")

    board = await db.scalar(select(Board).where(Board.id == column.board_id))
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board missing")

    await ensure_project_member(board.project_id, current_user, db)
    await db.delete(column)
    await db.commit()
    await broadcast(
        "column.deleted",
        {"id": str(column_id)},
        room=f"project:{board.project_id}",
    )


@router.patch("/{column_id}", response_model=ColumnRead)
async def update_column(
    column_id: uuid.UUID,
    payload: ColumnUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Column:
    column = await db.scalar(select(Column).where(Column.id == column_id))
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")

    board = await db.scalar(select(Board).where(Board.id == column.board_id))
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board missing")

    await ensure_project_member(board.project_id, current_user, db)

    if payload.name is not None:
        column.name = payload.name
    if payload.order is not None:
        column.order = payload.order

    await db.commit()
    await db.refresh(column)
    return column
