"""Saved items API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, SavedItem, SavedItemType, Collection

router = APIRouter()


class SaveItemRequest(BaseModel):
    item_type: str
    item_id: str
    item_name: str
    item_image_url: Optional[str] = None
    item_metadata: Optional[dict] = None
    notes: Optional[str] = None
    collection_id: Optional[str] = None


@router.get("")
async def get_saved_items(
    item_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(SavedItem).where(SavedItem.user_id == current_user.id)
    if item_type:
        query = query.where(SavedItem.item_type == item_type)
    query = query.order_by(SavedItem.created_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "item_type": i.item_type.value,
            "item_id": str(i.item_id),
            "item_name": i.item_name,
            "item_image_url": i.item_image_url,
            "item_metadata": i.item_metadata,
            "notes": i.notes,
            "collection_id": str(i.collection_id) if i.collection_id else None,
            "created_at": i.created_at.isoformat(),
        }
        for i in items
    ]


@router.post("", status_code=201)
async def save_item(
    payload: SaveItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        item_type = SavedItemType(payload.item_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid item_type")

    item = SavedItem(
        user_id=current_user.id,
        item_type=item_type,
        item_id=str(payload.item_id),
        item_name=payload.item_name,
        item_image_url=payload.item_image_url,
        item_metadata=payload.item_metadata,
        notes=payload.notes,
        collection_id=uuid.UUID(payload.collection_id) if payload.collection_id else None,
    )
    db.add(item)
    await db.commit()
    return {"id": str(item.id), "message": "Saved successfully"}


@router.delete("/{item_id}")
async def remove_saved_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedItem).where(SavedItem.id == item_id, SavedItem.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Saved item not found")
    await db.delete(item)
    await db.commit()
    return {"message": "Removed from saved"}
