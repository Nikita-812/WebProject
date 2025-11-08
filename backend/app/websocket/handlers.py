from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select

from app.db.session import AsyncSessionLocal
from app.main import sio
from app.models import Card, Column, Member, Message, Project, User
from app.schemas.card import CardRead
from app.services.events import EventDeduplicator
from app.services.redis import get_redis
from app.services.security import decode_token

NAMESPACE = "/ws"
SESSION_STORE: dict[str, uuid.UUID] = {}


async def _ensure_authenticated(sid: str) -> uuid.UUID:
    user_id = SESSION_STORE.get(sid)
    if not user_id:
        raise ConnectionRefusedError("Not authenticated")
    return user_id


async def _ensure_project_access(project_id: uuid.UUID, user_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Project.id)
            .outerjoin(Member, Member.project_id == Project.id)
            .where(Project.id == project_id)
            .where(or_(Project.owner_id == user_id, Member.user_id == user_id))
        )
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            raise PermissionError("Forbidden")


async def _is_duplicate(event_id: str | None) -> bool:
    if not event_id:
        return False
    try:
        deduper = EventDeduplicator(get_redis())
        return await deduper.mark_and_check(uuid.UUID(event_id))
    except Exception:
        return False


@sio.event(namespace=NAMESPACE)
async def connect(sid, environ, auth):  # pragma: no cover - socket lifecycle
    token = (auth or {}).get("token")
    if not token:
        return False
    try:
        payload = decode_token(token)
        user_id = uuid.UUID(payload.get("sub"))
    except Exception:
        return False
    SESSION_STORE[sid] = user_id
    return True


@sio.event(namespace=NAMESPACE)
async def disconnect(sid):  # pragma: no cover - socket lifecycle
    SESSION_STORE.pop(sid, None)


@sio.on("join_room", namespace=NAMESPACE)
async def join_room(sid, data):
    user_id = await _ensure_authenticated(sid)
    project_id = uuid.UUID(data["projectId"])
    await _ensure_project_access(project_id, user_id)
    room = f"project:{project_id}"
    await sio.enter_room(sid, room, namespace=NAMESPACE)
    await sio.emit(
        "user.joined",
        {"projectId": str(project_id), "userId": str(user_id)},
        room=room,
        skip_sid=sid,
        namespace=NAMESPACE,
    )
    return {"joined": True}


@sio.on("leave_room", namespace=NAMESPACE)
async def leave_room(sid, data):
    project_id = uuid.UUID(data["projectId"])
    room = f"project:{project_id}"
    await sio.leave_room(sid, room, namespace=NAMESPACE)
    return {"left": True}


@sio.on("card.create", namespace=NAMESPACE)
async def card_create(sid, data):
    if await _is_duplicate(data.get("eventId")):
        return {"duplicate": True}

    user_id = await _ensure_authenticated(sid)
    project_id = uuid.UUID(data["projectId"])
    column_id = uuid.UUID(data["columnId"])
    await _ensure_project_access(project_id, user_id)

    async with AsyncSessionLocal() as db:
        column = await db.scalar(select(Column).where(Column.id == column_id))
        if not column:
            raise RuntimeError("Column not found")
        max_position = await db.scalar(select(func.max(Card.position)).where(Card.column_id == column_id))
        card = Card(
            project_id=project_id,
            column_id=column_id,
            title=data["title"],
            description=data.get("description"),
            position=data.get("position") or (max_position or -1) + 1,
        )
        db.add(card)
        await db.commit()
        await db.refresh(card)

    payload = CardRead.model_validate(card).model_dump(mode="json")
    await sio.emit("card.created", payload, room=f"project:{project_id}", skip_sid=sid, namespace=NAMESPACE)
    return {"id": str(card.id), "version": card.version}


@sio.on("card.update", namespace=NAMESPACE)
async def card_update(sid, data):
    if await _is_duplicate(data.get("eventId")):
        return {"duplicate": True}

    user_id = await _ensure_authenticated(sid)
    card_id = uuid.UUID(data["id"])

    async with AsyncSessionLocal() as db:
        card = await db.scalar(select(Card).where(Card.id == card_id))
        if not card:
            raise RuntimeError("Card not found")
        await _ensure_project_access(card.project_id, user_id)
        if data.get("clientVersion") != card.version:
            return {
                "conflict": True,
                "serverVersion": card.version,
                "serverState": CardRead.model_validate(card).model_dump(mode="json"),
            }
        patch = data.get("patch", {})
        for key, value in patch.items():
            if hasattr(card, key):
                setattr(card, key, value)
        card.version += 1
        await db.commit()
        await db.refresh(card)
        payload = CardRead.model_validate(card).model_dump(mode="json")

    await sio.emit("card.updated", payload, room=f"project:{card.project_id}", skip_sid=sid, namespace=NAMESPACE)
    return {"newVersion": card.version}


@sio.on("card.move", namespace=NAMESPACE)
async def card_move(sid, data):
    if await _is_duplicate(data.get("eventId")):
        return {"duplicate": True}

    user_id = await _ensure_authenticated(sid)
    card_id = uuid.UUID(data["id"])

    async with AsyncSessionLocal() as db:
        card = await db.scalar(select(Card).where(Card.id == card_id))
        if not card:
            raise RuntimeError("Card not found")
        await _ensure_project_access(card.project_id, user_id)
        if data.get("clientVersion") != card.version:
            return {
                "conflict": True,
                "serverVersion": card.version,
                "serverState": CardRead.model_validate(card).model_dump(mode="json"),
            }
        if data.get("fromColumnId") and str(card.column_id) != data["fromColumnId"]:
            raise RuntimeError("Invalid column state")
        card.column_id = uuid.UUID(data["toColumnId"])
        card.position = data["position"]
        card.version += 1
        await db.commit()
        await db.refresh(card)
        payload = {
            "id": str(card.id),
            "fromColumnId": data["fromColumnId"],
            "toColumnId": data["toColumnId"],
            "position": data["position"],
            "version": card.version,
        }

    await sio.emit("card.moved", payload, room=f"project:{card.project_id}", skip_sid=sid, namespace=NAMESPACE)
    return {"moved": True}


@sio.on("chat.message", namespace=NAMESPACE)
async def chat_message(sid, data):
    if await _is_duplicate(data.get("eventId")):
        return {"duplicate": True}

    user_id = await _ensure_authenticated(sid)
    project_id = uuid.UUID(data["projectId"])
    await _ensure_project_access(project_id, user_id)

    async with AsyncSessionLocal() as db:
        message = Message(project_id=project_id, user_id=user_id, content=data["text"])
        db.add(message)
        await db.commit()
        await db.refresh(message)
        display_name = await db.scalar(select(User.display_name).where(User.id == user_id))
        payload = {
            "id": str(message.id),
            "projectId": str(project_id),
            "userId": str(user_id),
            "text": message.content,
            "createdAt": message.created_at.isoformat(),
            "displayName": display_name,
        }

    await sio.emit("chat.message.created", payload, room=f"project:{project_id}", skip_sid=sid, namespace=NAMESPACE)
    return {"id": payload["id"], "createdAt": payload["createdAt"]}


@sio.on("chat.typing", namespace=NAMESPACE)
async def chat_typing(sid, data):
    user_id = await _ensure_authenticated(sid)
    project_id = uuid.UUID(data["projectId"])
    await _ensure_project_access(project_id, user_id)

    async with AsyncSessionLocal() as db:
        display_name = await db.scalar(select(User.display_name).where(User.id == user_id))

    await sio.emit(
        "chat.typing",
        {"projectId": str(project_id), "userId": str(user_id), "displayName": display_name},
        room=f"project:{project_id}",
        skip_sid=sid,
        namespace=NAMESPACE,
    )
