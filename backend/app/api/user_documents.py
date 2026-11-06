"""Private user document library. Ownership always comes from the bearer token."""
from pathlib import Path
import json
import re
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.models import User, Document, DocumentChunk
from app.services.document_service import extract_upload, process_document, save_original, remove_document, STORAGE_ROOT
from app.api.admin import _document_summary
from app.rag.retrieval import rag_pipeline
from app.services.gemini_service import gemini_service

router = APIRouter()


class DocumentQuestion(BaseModel):
    message: str


def _extractive_summary(content: str, max_points: int = 6) -> list[str]:
    """Build a small, faithful summary when Gemini is unavailable."""
    normalized = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", content or "")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    sentences = [part.strip(" -•\t") for part in re.split(r"(?<=[.!?])\s+", normalized) if len(part.strip()) > 30]
    if len(sentences) <= max_points:
        return sentences

    # Prefer useful travel facts, then keep the selected passages in source
    # order so the fallback remains easy to read and verify.
    fact_pattern = re.compile(r"\b(best|crowd|quiet|busy|limited|accessib|station|airport|minutes|vegetarian|step-free|steep|late arrival|flat)\b", re.IGNORECASE)
    ranked = sorted(
        enumerate(sentences),
        key=lambda item: (
            2 * bool(fact_pattern.search(item[1])) + bool(re.search(r"\d", item[1])) + (len(item[1]) > 80),
            len(item[1]),
        ),
        reverse=True,
    )
    selected_indices = sorted(index for index, _ in ranked[:max_points])
    return [sentences[index] for index in selected_indices]


def _owned(doc: Document | None, user: User) -> Document:
    if doc is None or doc.access_scope != "private" or str(doc.owner_id) != str(user.id):
        raise HTTPException(404, "Document not found")
    return doc


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), title: str | None = Form(None), description: str | None = Form(None),
                         category: str | None = Form(None), country: str | None = Form(None), city: str | None = Form(None),
                         language: str = Form("en"), db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    text, raw, ext = await extract_upload(file)
    path = await save_original(raw, ext)
    doc = Document(source_type="personal_document", source_name=Path(file.filename or "Document").name,
                   title=title or Path(file.filename or "Document").stem, content=text, category=category,
                   country=country, city=city, language=language, description=description,
                   original_filename=Path(file.filename or "document").name, file_type=ext, storage_path=path,
                   uploaded_by=user.id, owner_id=user.id, access_scope="private", status="pending", is_active=False)
    db.add(doc)
    await db.flush()
    try:
        await process_document(db, doc, text)
        await db.commit()
    except Exception as exc:
        await db.commit()
        raise HTTPException(503, "Document was saved but processing failed; retry later") from exc
    return _document_summary(doc)


@router.get("")
async def list_documents(q: str | None = None, status: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Document).where(Document.owner_id == user.id, Document.access_scope == "private").order_by(Document.created_at.desc())
    if q: query = query.where(Document.title.ilike(f"%{q}%") | Document.original_filename.ilike(f"%{q}%"))
    if status: query = query.where(Document.status == status)
    return [_document_summary(d) for d in (await db.execute(query.limit(200))).scalars().all()]


@router.get("/{document_id}")
async def get_document(document_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _owned(await db.get(Document, document_id), user)
    return {**_document_summary(doc), "content": doc.content}


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _owned(await db.get(Document, document_id), user)
    await remove_document(db, doc)
    await db.commit()
    return {"deleted": True}


@router.get("/{document_id}/chunks")
async def get_chunks(document_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _owned(await db.get(Document, document_id), user)
    chunks = (await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index))).scalars().all()
    return [{"id": str(c.id), "chunk_index": c.chunk_index, "content": c.content, "page_number": c.page_number} for c in chunks]


@router.post("/{document_id}/ask")
async def ask_document(document_id: str, payload: DocumentQuestion, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Answer from one owned document only; this path never invokes live/global retrieval."""
    doc = _owned(await db.get(Document, document_id), user)
    if doc.status != "completed" or not doc.is_active:
        raise HTTPException(409, "This document is still processing or unavailable")
    message = payload.message.strip()
    if not message:
        raise HTTPException(422, "Ask a question about this document")

    context_docs, citations, metadata = await rag_pipeline.retrieve(
        query=message,
        db=db,
        filters={"owner_user_id": user.id, "document_id": str(doc.id)},
        top_k=6,
    )
    # Defense in depth: only source chunks from the selected owned document
    # may be passed to the model or included as citations.
    context_docs = [item for item in context_docs if str(item.get("document_id") or "") == str(doc.id)]
    citations = [item for item in citations if str(item.get("document_id") or "") == str(doc.id)]
    metadata["scope"] = "selected_document"
    metadata["document_id"] = str(doc.id)
    if not context_docs:
        return {
            "answer": "I couldn't find a relevant passage in this document. Try rephrasing your question or using a specific name, topic, or phrase from the file.",
            "citations": [],
            "metadata": metadata,
        }

    parts: list[str] = []
    generation_failed = False
    async for chunk in gemini_service.chat_stream(
        messages=[{"role": "user", "content": message}],
        context_docs=context_docs,
    ):
        event = json.loads(chunk)
        if event.get("type") == "content":
            parts.append(event.get("text", ""))
        elif event.get("type") == "error":
            generation_failed = True
            break
    answer = "".join(parts).strip()
    if not answer:
        is_summary = re.search(r"\b(summarize|summary|overview)\b", message, re.IGNORECASE)
        if generation_failed and is_summary:
            points = _extractive_summary(doc.content or "")
            if points:
                answer = "Gemini is temporarily unavailable, so here is an extractive summary from the selected document:\n\n" + "\n".join(f"• {point}" for point in points)
        if not answer:
            source = next((item for item in citations if item.get("snippet")), None)
            if source and generation_failed:
                answer = f"Gemini is temporarily unavailable, so here is the closest passage from this document: “{source['snippet'].strip()}”"
            elif source:
                answer = f"I couldn't generate a full answer, but the closest passage in this document says: “{source['snippet'].strip()}”"
        if not answer:
            answer = "I couldn't generate an answer from this document right now. Please try again."
    return {"answer": answer, "citations": citations, "metadata": metadata}


@router.post("/{document_id}/reprocess")
async def reprocess_document(document_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _owned(await db.get(Document, document_id), user)
    try:
        await process_document(db, doc, doc.content)
        await db.commit()
    except Exception as exc:
        await db.commit()
        raise HTTPException(503, "Reprocessing failed") from exc
    return _document_summary(doc)


@router.get("/{document_id}/download")
async def download_document(document_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _owned(await db.get(Document, document_id), user)
    if not doc.storage_path: raise HTTPException(404, "Original file unavailable")
    path = (STORAGE_ROOT / Path(doc.storage_path).name).resolve()
    if path.parent != STORAGE_ROOT.resolve() or not path.exists(): raise HTTPException(404, "Original file unavailable")
    return FileResponse(path, filename=doc.original_filename or "document")
