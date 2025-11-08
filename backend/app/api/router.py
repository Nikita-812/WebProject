from fastapi import APIRouter

from app.api.routes import auth, board, cards, chat, columns, files, projects, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(board.router)
api_router.include_router(columns.router)
api_router.include_router(cards.router)
api_router.include_router(chat.router)
api_router.include_router(files.router)
