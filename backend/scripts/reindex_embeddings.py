"""Re-embed stored RAG chunks after changing the Gemini embedding model.

Run from ``backend/`` with ``PYTHONPATH=. python scripts/reindex_embeddings.py``.
Use ``--dry-run`` to count chunks without calling Gemini or changing the database.
All new vectors are committed in one transaction so a failed run leaves the old
index intact rather than mixing embedding spaces.
"""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.db.database import AsyncSessionLocal, engine
from app.models.models import DocumentChunk
from app.services.gemini_service import gemini_service


async def reindex(dry_run: bool = False) -> int:
    async with AsyncSessionLocal() as db:
        async with db.begin():
            result = await db.scalars(
                select(DocumentChunk).order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
            )
            chunks = result.all()
            if dry_run:
                print(f"Would re-embed {len(chunks)} document chunks.")
                return len(chunks)

            for index, chunk in enumerate(chunks, start=1):
                embedding = await gemini_service.generate_embedding(
                    chunk.content,
                    task_type="retrieval_document",
                )
                if len(embedding) != settings.GEMINI_EMBEDDING_DIMENSIONS:
                    raise ValueError(
                        f"Embedding dimension mismatch for chunk {chunk.id}: "
                        f"got {len(embedding)}, expected {settings.GEMINI_EMBEDDING_DIMENSIONS}."
                    )
                chunk.embedding = embedding
                if index % 50 == 0 or index == len(chunks):
                    print(f"Prepared {index}/{len(chunks)} chunks.")

        print(f"Re-embedded {len(chunks)} document chunks with {gemini_service.embedding_model}.")
        return len(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Count chunks without calling Gemini.")
    args = parser.parse_args()
    try:
        asyncio.run(reindex(dry_run=args.dry_run))
    finally:
        asyncio.run(engine.dispose())


if __name__ == "__main__":
    main()
