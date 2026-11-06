"""Read-only document preview endpoint for retrieved citations."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.models import User, Document

router = APIRouter()


@router.get("/{document_id}")
async def read_accessible_document(document_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if doc is None or (doc.access_scope == "private" and str(doc.owner_id) != str(user.id)) or not doc.is_active:
        raise HTTPException(404, "Document not found")
    return {"id": str(doc.id), "title": doc.title, "content": doc.content, "source_type": doc.source_type,
            "access_scope": doc.access_scope, "category": doc.category, "country": doc.country, "city": doc.city}
