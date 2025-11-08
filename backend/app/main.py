from __future__ import annotations

import contextlib

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_limiter import FastAPILimiter

from app.api.router import api_router
from app.core.config import settings
from app.services.redis import close_redis, get_redis, init_redis
from app.services.bus import attach_socket

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=settings.cors_origins)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    await FastAPILimiter.init(get_redis())
    yield
    await FastAPILimiter.close()
    await close_redis()


app = FastAPI(title=settings.project_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)


from app.websocket import handlers  # noqa: E402  # ensure handlers register events

attach_socket(sio)
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

__all__ = ["app", "socket_app", "sio"]
