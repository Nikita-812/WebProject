from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owned_projects: Mapped[list[Project]] = relationship(back_populates="owner", cascade="all,delete")
    memberships: Mapped[list[Member]] = relationship(back_populates="user", cascade="all,delete")
    messages: Mapped[list[Message]] = relationship(back_populates="author")
    files: Mapped[list[FileAsset]] = relationship(back_populates="author")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="owned_projects")
    members: Mapped[list[Member]] = relationship(back_populates="project", cascade="all,delete")
    boards: Mapped[list[Board]] = relationship(back_populates="project", cascade="all,delete")
    cards: Mapped[list[Card]] = relationship(back_populates="project", cascade="all,delete")


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (
        CheckConstraint("role IN ('owner','member')", name="members_role_check"),
        {
            "mysql_engine": "InnoDB",
        },
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), default="member", nullable=False)

    user: Mapped[User] = relationship(back_populates="memberships")
    project: Mapped[Project] = relationship(back_populates="members")


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped[Project] = relationship(back_populates="boards")
    columns: Mapped[list[Column]] = relationship(back_populates="board", cascade="all,delete")


class Column(Base):
    __tablename__ = "columns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    order: Mapped[int] = mapped_column(
        "order", Integer, nullable=False, default=0, server_default=text("0")
    )

    board: Mapped[Board] = relationship(back_populates="columns")
    cards: Mapped[list[Card]] = relationship(back_populates="column", cascade="all,delete")


class Card(Base, TimestampMixin):
    __tablename__ = "cards"
    __table_args__ = (
        CheckConstraint("priority IN ('low','medium','high') OR priority IS NULL", name="cards_priority_check"),
        Index("idx_cards_project", "project_id"),
        Index("idx_cards_column_pos", "column_id", "position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    column_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    labels: Mapped[list[dict] | list[str]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    assignees: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb")
    )
    priority: Mapped[str | None] = mapped_column(String(12))
    due_date: Mapped[date | None] = mapped_column(Date())
    position: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"), nullable=False)

    project: Mapped[Project] = relationship(back_populates="cards")
    column: Mapped[Column] = relationship(back_populates="cards")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("idx_messages_proj_time", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    author: Mapped[User] = relationship(back_populates="messages")


class FileAsset(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime: Mapped[str] = mapped_column(String(120), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    author: Mapped[User] = relationship(back_populates="files")


class EventAudit(Base):
    __tablename__ = "events_audit"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
