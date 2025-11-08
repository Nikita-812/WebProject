from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Board as BoardModel
from app.models import Card, Column
from app.schemas.board import BoardSnapshot
from app.utils.permissions import ensure_project_member

router = APIRouter(prefix="/projects", tags=["board"])


@router.get("/{project_id}/board", response_model=BoardSnapshot)
async def get_board_snapshot(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await ensure_project_member(project_id, current_user, db)

    board = await db.scalar(select(BoardModel).where(BoardModel.project_id == project_id))
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    columns_result = await db.execute(select(Column).where(Column.board_id == board.id).order_by(Column.order))
    cards_result = await db.execute(
        select(Card).where(Card.project_id == project_id).order_by(Card.column_id, Card.position)
    )

    columns = columns_result.scalars().all()
    cards = cards_result.scalars().all()
    return BoardSnapshot(board_id=board.id, columns=columns, cards=cards)
