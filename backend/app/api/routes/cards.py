from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Card, Column, Project
from app.schemas.card import CardCreate, CardMoveRequest, CardRead, CardUpdate
from app.utils.permissions import ensure_project_member
from app.services.bus import broadcast

router = APIRouter(prefix="/cards", tags=["cards"])


async def _get_card_or_404(card_id: uuid.UUID, db: AsyncSession) -> Card:
    card = await db.scalar(select(Card).where(Card.id == card_id))
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return card


@router.post("", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def create_card(
    payload: CardCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Card:
    project = await db.scalar(select(Project).where(Project.id == payload.project_id))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await ensure_project_member(project.id, current_user, db)

    column = await db.scalar(select(Column).where(Column.id == payload.column_id))
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")

    max_position = await db.scalar(
        select(func.max(Card.position)).where(Card.column_id == payload.column_id)
    )
    position = payload.position if payload.position is not None else (max_position or -1) + 1

    card = Card(
        project_id=payload.project_id,
        column_id=payload.column_id,
        title=payload.title,
        description=payload.description,
        labels=payload.labels,
        assignees=payload.assignees,
        priority=payload.priority,
        due_date=payload.due_date,
        position=position,
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)
    card_payload = CardRead.model_validate(card).model_dump(mode="json")
    await broadcast("card.created", card_payload, room=f"project:{card.project_id}")
    return card


@router.get("/{card_id}", response_model=CardRead)
async def get_card(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Card:
    card = await _get_card_or_404(card_id, db)
    await ensure_project_member(card.project_id, current_user, db)
    return card


@router.patch("/{card_id}", response_model=CardRead)
async def update_card(
    card_id: uuid.UUID,
    payload: CardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Card:
    card = await _get_card_or_404(card_id, db)
    await ensure_project_member(card.project_id, current_user, db)

    if payload.version != card.version:
        state_payload = CardRead.model_validate(card).model_dump(mode="json")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=jsonable_encoder(
                {
                    "serverVersion": card.version,
                    "serverState": state_payload,
                },
            ),
        )

    update_fields = payload.model_dump(exclude_unset=True, exclude={"version"}, by_alias=False)
    for field, value in update_fields.items():
        setattr(card, field, value)

    card.version += 1
    await db.commit()
    await db.refresh(card)
    card_payload = CardRead.model_validate(card).model_dump(mode="json")
    await broadcast("card.updated", card_payload, room=f"project:{card.project_id}")
    return card


@router.post("/{card_id}/move", response_model=CardRead)
async def move_card(
    card_id: uuid.UUID,
    payload: CardMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Card:
    if payload.id != card_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload mismatch")

    card = await _get_card_or_404(card_id, db)
    await ensure_project_member(card.project_id, current_user, db)

    if payload.client_version != card.version:
        state_payload = CardRead.model_validate(card).model_dump(mode="json")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=jsonable_encoder(
                {
                    "serverVersion": card.version,
                    "serverState": state_payload,
                },
            ),
        )

    if card.column_id != payload.from_column_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Column mismatch")

    card.column_id = payload.to_column_id
    card.position = payload.position
    card.version += 1

    await db.commit()
    await db.refresh(card)
    await broadcast(
        "card.moved",
        {
            "id": str(card.id),
            "fromColumnId": str(payload.from_column_id),
            "toColumnId": str(payload.to_column_id),
            "position": payload.position,
            "version": card.version,
        },
        room=f"project:{card.project_id}",
    )
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> None:
    card = await _get_card_or_404(card_id, db)
    await ensure_project_member(card.project_id, current_user, db)
    await db.delete(card)
    await db.commit()
    await broadcast(
        "card.deleted",
        {"id": str(card_id)},
        room=f"project:{card.project_id}",
    )
