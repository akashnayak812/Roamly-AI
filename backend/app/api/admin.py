"""Admin API — dataset ingestion, pipeline execution, system health, and error logs."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
import json
import csv
import io
from typing import List, Dict, Any, Optional
import structlog

from app.db.database import get_db
from app.models.models import Destination, Attraction, Document, DocumentChunk, Place
from app.services.gemini_service import gemini_service
from app.services.ingestion_service import ingestion_service, IngestionSummary
from app.services.hotel_ingestion_service import hotel_ingestion_service, HotelIngestionReport
from app.core.deps import get_admin_user
from app.models.models import User, DocumentProcessingJob
from app.services.document_service import extract_upload, process_document, save_original, remove_document, STORAGE_ROOT
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter(dependencies=[Depends(get_admin_user)])
log = structlog.get_logger()


@router.get("/stats")
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """Fetch system database record statistics."""
    dest_count = (await db.execute(select(func.count(Destination.id)))).scalar()
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar()
    chunk_count = (await db.execute(select(func.count(DocumentChunk.id)))).scalar()
    place_count = (await db.execute(select(func.count(Place.id)))).scalar()

    return {
        "destinations": dest_count,
        "places": place_count,
        "documents": doc_count,
        "document_chunks": chunk_count,
        "status": "healthy",
    }


@router.post("/ingestion/run", response_model=IngestionSummary)
async def run_ingestion_pipeline(
    background_tasks: BackgroundTasks,
    directory_path: str = "data/processed",
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger end-to-end dataset ingestion from processed data files.
    Loads destinations.json & attractions.json, normalizes schemas, verifies coordinates,
    populates places table, and builds search vector chunks.
    """
    summary = await ingestion_service.ingest_processed_directory(
        directory_path=directory_path,
        db=db,
    )
    return summary


@router.get("/ingestion/status")
async def get_ingestion_status():
    """Retrieve current ingestion pipeline status and last run execution metrics."""
    return ingestion_service.get_status()


@router.get("/ingestion/errors")
async def get_ingestion_errors():
    """Retrieve detailed validation or processing errors encountered during ingestion."""
    return {"errors": ingestion_service.get_errors()}


@router.post("/ingest/hotels", response_model=HotelIngestionReport)
async def ingest_hotels_endpoint(
    background_tasks: BackgroundTasks,
    background: bool = False,
    file_path: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest the 59,707 hotel dataset from data/processed/hotels.json.
    Preserves all records, stable IDs, resolves destinations, and reports metrics.
    """
    if background:
        background_tasks.add_task(hotel_ingestion_service.ingest_hotels, file_path=file_path)
        return HotelIngestionReport(
            input_rows=59707,
            inserted_rows=0,
            updated_rows=0,
            failed_rows=0,
            preserved_row_count=True,
            status="running",
            errors=[],
        )
    report = await hotel_ingestion_service.ingest_hotels(file_path=file_path, db=db)
    return report


@router.get("/ingest/hotels/status")
async def get_hotel_ingestion_status():
    """Retrieve current status and metrics of hotel dataset ingestion."""
    return hotel_ingestion_service.get_status()


@router.post("/import/dataset")
async def import_uploaded_dataset(
    file: UploadFile = File(...),
    dataset_type: str = "places",  # destinations, attractions, places
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and import a JSON or CSV dataset file with automatic validation and normalization.
    """
    content = await file.read()
    if not (file.filename.endswith(".json") or file.filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Only JSON and CSV formats are supported")

    try:
        if file.filename.endswith(".json"):
            data = json.loads(content.decode("utf-8"))
            records = data if isinstance(data, list) else data.get("items", data.get("places", []))
        else:
            reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
            records = list(reader)

        imported = 0
        errors = []

        for r in records:
            try:
                name = r.get("name") or r.get("title")
                if not name:
                    continue
                category = r.get("category", "attraction")
                place = Place(
                    name=name,
                    category=category,
                    description=r.get("description"),
                    city=r.get("city"),
                    country=r.get("country", "India"),
                    latitude=float(r["latitude"]) if r.get("latitude") else None,
                    longitude=float(r["longitude"]) if r.get("longitude") else None,
                    rating=float(r["rating"]) if r.get("rating") else 4.0,
                    review_count=int(r["review_count"]) if r.get("review_count") else 50,
                    source="uploaded_dataset",
                )
                db.add(place)
                imported += 1
            except Exception as e:
                errors.append({"record": r.get("name", "unknown"), "error": str(e)})

        await db.commit()
        return {"imported": imported, "errors": errors, "total": len(records)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(exc)}")


@router.post("/ingest/destinations")
async def ingest_destinations(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Ingest destinations from JSON or CSV file."""
    content = await file.read()

    if file.filename.endswith(".json"):
        data = json.loads(content)
        destinations = data if isinstance(data, list) else data.get("destinations", [])
    elif file.filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content.decode()))
        destinations = list(reader)
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use JSON or CSV.")

    ingested = 0
    errors = []

    for item in destinations:
        try:
            slug = item.get("slug") or item.get("name", "").lower().replace(" ", "-")
            existing = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
            if existing:
                continue

            dest = Destination(
                slug=slug,
                name=item.get("name", ""),
                country=item.get("country", ""),
                state=item.get("state"),
                city=item.get("city"),
                region=item.get("region"),
                description=item.get("description"),
                hero_image_url=item.get("hero_image_url") or item.get("image_url"),
                categories=item.get("categories", []),
                tags=item.get("tags", []),
                best_time_to_visit=item.get("best_time_to_visit"),
                avg_rating=float(item["avg_rating"]) if item.get("avg_rating") else None,
                safety_score=float(item["safety_score"]) if item.get("safety_score") else None,
                avg_daily_cost_min=float(item["avg_daily_cost_min"]) if item.get("avg_daily_cost_min") else None,
                avg_daily_cost_max=float(item["avg_daily_cost_max"]) if item.get("avg_daily_cost_max") else None,
                latitude=float(item["latitude"]) if item.get("latitude") else None,
                longitude=float(item["longitude"]) if item.get("longitude") else None,
                is_family_friendly=bool(item.get("is_family_friendly", True)),
                is_romantic=bool(item.get("is_romantic", False)),
                is_hidden_gem=bool(item.get("is_hidden_gem", False)),
                popularity_score=float(item.get("popularity_score", 50)),
            )
            db.add(dest)
            ingested += 1
        except Exception as e:
            errors.append({"item": item.get("name", "unknown"), "error": str(e)})

    await db.commit()
    return {"ingested": ingested, "errors": errors, "total": len(destinations)}


@router.post("/documents/upload")
@router.post("/ingest/documents")
async def ingest_documents(
    file: UploadFile = File(...),
    source_type: str = Form("tourism_guide"),
    title: str | None = Form(None),
    description: str | None = Form(None),
    category: str | None = Form(None),
    country: str | None = Form(None),
    city: str | None = Form(None),
    language: str = Form("en"),
    tags: str | None = Form(None),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest text documents into the RAG knowledge base."""
    text_content, raw, ext = await extract_upload(file)
    path = await save_original(raw, ext)
    doc = Document(source_type=source_type, source_name=file.filename, title=title or Path(file.filename or "Document").stem,
                   content=text_content, category=category, country=country, city=city, language=language,
                   description=description, original_filename=Path(file.filename or "document").name,
                   file_type=ext, storage_path=path, uploaded_by=current_user.id, owner_id=None,
                   access_scope="global", status="pending", is_active=False,
                   tags=[tag.strip() for tag in (tags or "").split(",") if tag.strip()])
    db.add(doc)
    await db.flush()
    try:
        await process_document(db, doc, text_content)
        await db.commit()
    except Exception as exc:
        await db.commit()
        raise HTTPException(503, "Document was saved but embedding processing failed; retry from document management") from exc
    return {"id": str(doc.id), "title": doc.title, "status": doc.status, "total_chunks": doc.total_chunks}


@router.get("/documents")
async def list_admin_documents(q: str | None = None, status: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Document).where(Document.access_scope == "global").order_by(Document.created_at.desc())
    if status:
        query = query.where(Document.status == status)
    if q:
        query = query.where(Document.title.ilike(f"%{q}%") | Document.original_filename.ilike(f"%{q}%"))
    docs = (await db.execute(query.limit(200))).scalars().all()
    return [_document_summary(doc) for doc in docs]


def _document_summary(doc: Document):
    return {"id": str(doc.id), "title": doc.title, "description": doc.description, "original_filename": doc.original_filename,
            "file_type": doc.file_type, "category": doc.category, "country": doc.country, "city": doc.city,
            "language": doc.language, "status": doc.status, "total_chunks": doc.total_chunks,
            "created_at": doc.created_at.isoformat(), "access_scope": doc.access_scope, "tags": doc.tags or []}


@router.get("/documents/stats")
async def document_stats(db: AsyncSession = Depends(get_db)):
    docs = (await db.execute(select(Document).where(Document.access_scope == "global"))).scalars().all()
    return {"total_documents": len(docs), "processed_documents": sum(d.status == "completed" for d in docs),
            "failed_documents": sum(d.status == "failed" for d in docs),
            "total_chunks": sum(d.total_chunks for d in docs),
            "storage_bytes": sum((STORAGE_ROOT / d.storage_path).stat().st_size for d in docs if d.storage_path and (STORAGE_ROOT / d.storage_path).exists())}


@router.get("/documents/processing-history")
async def processing_history(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(DocumentProcessingJob, Document.title).join(Document, Document.id == DocumentProcessingJob.document_id).where(Document.access_scope == "global").order_by(DocumentProcessingJob.started_at.desc()).limit(100))).all()
    return [{"document_id": str(job.document_id), "title": title, "status": job.status,
             "started_at": job.started_at.isoformat(), "completed_at": job.completed_at.isoformat() if job.completed_at else None,
             "error_message": job.error_message, "retry_count": job.retry_count} for job, title in rows]


@router.get("/documents/user-uploads")
async def user_upload_monitoring(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Document, User.email).outerjoin(User, Document.owner_id == User.id).where(Document.access_scope == "private").order_by(Document.created_at.desc()).limit(200))).all()
    return [{**_document_summary(d), "uploaded_by": email} for d, email in rows]


@router.get("/documents/{document_id}")
async def get_admin_document(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc or doc.access_scope != "global": raise HTTPException(404, "Document not found")
    return {**_document_summary(doc), "content": doc.content}


@router.put("/documents/{document_id}")
async def update_admin_document(document_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc or doc.access_scope != "global": raise HTTPException(404, "Document not found")
    for key in ("title", "description", "category", "country", "city", "language", "tags"):
        if key in payload: setattr(doc, key, payload[key])
    await db.commit()
    return _document_summary(doc)


@router.delete("/documents/{document_id}")
async def delete_admin_document(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc or doc.access_scope != "global": raise HTTPException(404, "Document not found")
    await remove_document(db, doc)
    await db.commit()
    return {"deleted": True}


@router.post("/documents/{document_id}/reprocess")
async def reprocess_admin_document(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc or doc.access_scope != "global": raise HTTPException(404, "Document not found")
    try:
        await process_document(db, doc, doc.content)
        await db.commit()
    except Exception as exc:
        await db.commit()
        raise HTTPException(503, "Reprocessing failed") from exc
    return _document_summary(doc)


@router.get("/documents/{document_id}/chunks")
async def get_admin_chunks(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc or doc.access_scope != "global": raise HTTPException(404, "Document not found")
    chunks = (await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index))).scalars().all()
    return [{"id": str(c.id), "chunk_index": c.chunk_index, "content": c.content, "page_number": c.page_number} for c in chunks]


@router.get("/documents/{document_id}/download")
async def download_admin_document(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc or doc.access_scope != "global" or not doc.storage_path: raise HTTPException(404, "Document not found")
    path = (STORAGE_ROOT / Path(doc.storage_path).name).resolve()
    if path.parent != STORAGE_ROOT.resolve() or not path.exists(): raise HTTPException(404, "Original file unavailable")
    return FileResponse(path, filename=doc.original_filename or "document")
