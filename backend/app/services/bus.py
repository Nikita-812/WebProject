from __future__ import annotations

from typing import Any

from fastapi.encoders import jsonable_encoder
from socketio import AsyncServer

NAMESPACE = "/ws"

_socket: AsyncServer | None = None


def attach_socket(server: AsyncServer) -> None:
    global _socket
    _socket = server


async def broadcast(event: str, payload: Any, room: str | None = None) -> None:
    if _socket is None:
        return
    encoded = jsonable_encoder(payload)
    await _socket.emit(event, encoded, room=room, namespace=NAMESPACE)
