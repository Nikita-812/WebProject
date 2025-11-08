from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    project_name: str = "Kanban Realtime API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(
        default="postgresql+psycopg://kanban:kanban@localhost:5432/kanban",
        validation_alias="DATABASE_URL",
    )
    async_database_url: str = Field(
        default="postgresql+asyncpg://kanban:kanban@localhost:5432/kanban",
        validation_alias="ASYNC_DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")
    jwt_secret: str = Field(default="please-change-me", validation_alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_minutes: int = 60 * 24 * 7
    cors_origins: List[AnyHttpUrl] | List[str] = Field(
        default_factory=lambda: ["http://localhost:5173"],
        validation_alias="BACKEND_CORS_ORIGINS",
    )
    rate_limit_default: str = "20/minute"
    uploads_dir: str = Field(default="storage/uploads")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
