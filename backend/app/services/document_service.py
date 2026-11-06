"""Secure document extraction, chunking, persistence, and file storage for RAG."""
from __future__ import annotations

import csv
import io
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Document, DocumentChunk, DocumentProcessingJob
from app.services.gemini_service import gemini_service

MAX_FILE_BYTES = 15 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".json", ".csv", ".md", ".markdown"}
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "private_uploads"


async def extract_upload(file: UploadFile) -> tuple[str, bytes, str]:
    filename = Path(file.filename or "upload").name
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "Supported formats: PDF, TXT, DOCX, JSON, CSV, Markdown")
    raw = await file.read(MAX_FILE_BYTES + 1)
    if not raw:
        raise HTTPException(400, "The uploaded file is empty")
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(413, "Maximum document size is 15 MB")
    if ext == ".pdf" and not raw.startswith(b"%PDF-"):
        raise HTTPException(400, "File content does not match the PDF extension")
    if ext == ".docx" and not raw.startswith(b"PK"):
        raise HTTPException(400, "File content does not match the DOCX extension")
    try:
        if ext == ".pdf":
            from PyPDF2 import PdfReader
            # Travel PDFs often contain minor structural defects that strict
            # parsing rejects even though their text layer is readable.
            reader = PdfReader(io.BytesIO(raw), strict=False)
            text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
        elif ext == ".docx":
            from docx import Document as WordDocument
            doc = WordDocument(io.BytesIO(raw))
            text = "\n\n".join(p.text for p in doc.paragraphs)
        elif ext == ".json":
            text = json.dumps(json.loads(raw.decode("utf-8-sig")), ensure_ascii=False, indent=2)
        elif ext == ".csv":
            text = "\n".join(", ".join(row) for row in csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
        else:
            text = raw.decode("utf-8-sig")
    except Exception as exc:
        raise HTTPException(400, f"Could not extract text from this {ext[1:].upper()} file") from exc
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 20:
        raise HTTPException(400, "No usable text was found in the document")
    return text, raw, ext[1:]


def chunk_text(text: str, max_chars: int = 3200, overlap_chars: int = 600) -> list[str]:
    """Split text at headings and paragraph boundaries before applying size limits.

    PDF extractors often emit one newline per visual line, so blank-line-only
    splitting can collapse an entire guide into one low-precision chunk.
    """
    paragraphs: list[tuple[str, bool]] = []
    current_lines: list[str] = []
    current_section_length = 0
    starts_new_section = False

    def flush_lines() -> None:
        nonlocal starts_new_section
        paragraph = " ".join(line.strip() for line in current_lines if line.strip()).strip()
        if paragraph:
            paragraphs.append((paragraph, starts_new_section))
            starts_new_section = False
        current_lines.clear()

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            flush_lines()
            continue
        is_heading = (
            len(stripped) <= 100
            and len(stripped.split()) <= 10
            and not re.search(r"[.!?;:,]$", stripped)
        )
        if is_heading and current_section_length >= 120:
            flush_lines()
            starts_new_section = True
            current_section_length = 0
        current_lines.append(stripped)
        current_section_length += len(stripped) + 1
    flush_lines()

    chunks: list[str] = []
    current = ""
    for paragraph, starts_new_section in paragraphs:
        if starts_new_section and current:
            chunks.append(current)
            current = ""
        while len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            cut = paragraph.rfind(" ", 0, max_chars)
            cut = cut if cut > max_chars // 2 else max_chars
            chunks.append(paragraph[:cut].strip())
            paragraph = paragraph[max(0, cut - overlap_chars):].strip()
        candidate = f"{current}\n\n{paragraph}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = (current[-overlap_chars:] + "\n\n" + paragraph).strip()
        else:
            current = candidate
    if current:
        chunks.append(current)
    return [chunk for chunk in chunks if chunk]


async def process_document(db: AsyncSession, doc: Document, content: str) -> None:
    doc.status = "processing"
    retries = (await db.execute(select(func.count(DocumentProcessingJob.id)).where(
        DocumentProcessingJob.document_id == doc.id, DocumentProcessingJob.status == "failed"
    ))).scalar_one()
    job = DocumentProcessingJob(document_id=doc.id, status="processing", started_at=datetime.now(timezone.utc), retry_count=retries)
    db.add(job)
    await db.flush()
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
    chunks = chunk_text(content)
    try:
        for index, body in enumerate(chunks):
            vector = await gemini_service.generate_embedding(body, task_type="retrieval_document")
            db.add(DocumentChunk(
                document_id=doc.id,
                chunk_index=index,
                content=body,
                embedding=vector,
                token_count=max(1, len(body) // 4),
                chunk_metadata={"title": doc.title, "source_type": doc.source_type, "category": doc.category,
                                "country": doc.country, "city": doc.city, "language": doc.language,
                                "access_scope": doc.access_scope, "owner_id": str(doc.owner_id) if doc.owner_id else None},
            ))
        doc.total_chunks = len(chunks)
        doc.status = "completed"
        doc.is_active = True
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None
        await db.flush()
    except Exception as exc:
        doc.status = "failed"
        doc.is_active = False
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = str(exc)[:2000]
        await db.flush()
        raise


async def save_original(raw: bytes, ext: str) -> str:
    key = f"{uuid.uuid4().hex}.{ext}"
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    (STORAGE_ROOT / key).write_bytes(raw)
    return key


async def remove_document(db: AsyncSession, doc: Document) -> None:
    await db.delete(doc)
    await db.flush()
    if doc.storage_path:
        path = (STORAGE_ROOT / Path(doc.storage_path).name).resolve()
        if path.parent == STORAGE_ROOT.resolve():
            path.unlink(missing_ok=True)
