from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models import FileAsset
from app.schemas.file import FileRead
from app.utils.permissions import ensure_project_member

router = APIRouter(prefix="/files", tags=["files"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("", response_model=FileRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    project_id: uuid.UUID,
    upload: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> FileAsset:
    await ensure_project_member(project_id, current_user, db)

    size = 0
    destination_dir = Path(settings.uploads_dir) / str(project_id)
    destination_dir.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4()
    original_name = upload.filename or "file"
    destination_path = destination_dir / f"{file_id}_{original_name}"

    with destination_path.open("wb") as buffer:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_SIZE:
                buffer.close()
                destination_path.unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large")
            buffer.write(chunk)
    await upload.close()

    file_record = FileAsset(
        id=file_id,
        project_id=project_id,
        user_id=current_user.id,
        path=str(destination_path),
        mime=upload.content_type or "application/octet-stream",
        size=size,
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)
    return file_record


@router.get("/{file_id}")
async def download_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    file_record = await db.scalar(select(FileAsset).where(FileAsset.id == file_id))
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    await ensure_project_member(file_record.project_id, current_user, db)

    if not os.path.exists(file_record.path):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="File missing on disk")

    return FileResponse(path=file_record.path, media_type=file_record.mime, filename=Path(file_record.path).name)
