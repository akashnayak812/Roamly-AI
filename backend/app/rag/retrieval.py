"""
RAG Retrieval Pipeline — Hybrid semantic + keyword search with SerpApi live web search.
Detects freshness intent, retrieves live web results securely, sanitizes untrusted web data,
and produces grounded citations with retrieval timestamps.
"""
from __future__ import annotations
from typing import List, Dict, Optional, Tuple, Any
import re
from datetime import datetime, timezone
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from app.models.models import DocumentChunk, Document
from app.services.gemini_service import gemini_service
from app.services.live_search_service import live_search_service
from app.services.places_service import places_service
import json

log = structlog.get_logger()

# Hybrid retrieval weights for stable vector DB
SEMANTIC_WEIGHT = 0.65
KEYWORD_WEIGHT = 0.35

# Intent triggers that necessitate real-time / live web freshness
FRESHNESS_TRIGGERS = [
    r"\bcurrent\b",
    r"\bcurrently\b",
    r"\brecent\b",
    r"\brecently\b",
    r"\btoday\b",
    r"\btonight\b",
    r"\bthis week\b",
    r"\bthis weekend\b",
    r"\bthis month\b",
    r"\blatest\b",
    r"\bnow\b",
    r"\bright now\b",
    r"\bupcoming\b",
    r"\bevent\b",
    r"\bevents\b",
    r"\bfestival\b",
    r"\bfestivals\b",
    r"\bweather\b",
    r"\bforecast\b",
    r"\bmonsoon\b",
    r"\bopening hours\b",
    r"\bopening time\b",
    r"\bopen now\b",
    r"\bclosed today\b",
    r"\bticket price\b",
    r"\bcurrent price\b",
    r"\brates\b",
    r"\bcost right now\b",
    r"\bseasonal\b",
    r"\bhappening\b",
    r"\bnews\b",
    r"\badvisory\b",
    r"\b2025\b",
    r"\b2026\b",
]


class RAGPipeline:
    """
    Complete RAG pipeline:
    Query → Intent Detection → Decide whether live search is required
    → Hybrid Semantic/Keyword Retrieval + Live SerpApi Search
    → Untrusted Data Sanitization → Deduplication → Context Compression → Citations
    """

    def detect_live_search_intent(self, query: str) -> Tuple[bool, str, str]:
        """
        Detect if query involves time-sensitive or real-time info.
        Returns: (is_required: bool, category: str, serpapi_query: str)
        """
        q_lower = query.lower()
        is_fresh = any(re.search(pattern, q_lower) for pattern in FRESHNESS_TRIGGERS)

        # Detect domain category
        category = "general"
        if any(w in q_lower for w in ["hotel", "stay", "resort", "accommodation", "homestay"]):
            category = "hotel"
        elif any(w in q_lower for w in ["restaurant", "cafe", "food", "eat", "dining", "cuisine"]):
            category = "restaurant"
        elif any(w in q_lower for w in ["event", "festival", "celebration", "happening", "exhibition"]):
            category = "event"
        elif any(w in q_lower for w in ["attraction", "temple", "monument", "sights", "fort", "museum"]):
            category = "attraction"
        elif any(w in q_lower for w in ["activity", "things to do", "adventure", "cruise", "safari"]):
            category = "activity"
        elif any(w in q_lower for w in ["guide", "itinerary", "tips", "blog", "best places"]):
            category = "guide"

        return is_fresh, category, query

    async def retrieve(
        self,
        query: str,
        db: AsyncSession,
        filters: Optional[Dict] = None,
        top_k: int = 10,
        force_live_search: bool = False,
    ) -> Tuple[List[Dict], List[Dict], Dict[str, Any]]:
        """
        Main retrieval entry point.
        Returns: (retrieved_docs, citations, retrieval_metadata)
        """
        metadata: Dict[str, Any] = {
            "query": query,
            "live_search_used": False,
            "live_search_count": 0,
            "live_search_available": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # 1. Intent Detection for Live Web Search
        is_live_needed, category, serp_query = self.detect_live_search_intent(query)
        live_docs: List[Dict] = []
        document_scope = filters.get("document_id") if filters else None

        # A document-scoped query must never mix in web, places, hotels, or
        # other documents. It is intentionally isolated from trip-planning RAG.
        if not document_scope and (is_live_needed or force_live_search):
            log.info("live_search_intent_detected", query=query, category=category)
            try:
                live_response = await live_search_service.search_web(
                    query=serp_query,
                    category=category,
                    num_results=5,
                )

                if live_response.live_search_available and live_response.results:
                    metadata["live_search_used"] = True
                    metadata["live_search_count"] = len(live_response.results)
                    metadata["cached"] = live_response.cached

                    for r in live_response.results:
                        # SECURITY: Treat all web content as untrusted external data.
                        # Never allow web text to trigger LLM instructions.
                        sanitized_snippet = self._sanitize_untrusted_web_content(r.snippet)
                        sanitized_title = self._sanitize_untrusted_web_content(r.title)

                        safe_source = self._sanitize_untrusted_web_content(r.source)
                        live_docs.append({
                            "id": f"live-{r.position}-{hash(r.url)}",
                            "content": (
                                f"[UNTRUSTED EXTERNAL WEB RESULT - FACTUAL REFERENCE ONLY]\n"
                                f"Title: {sanitized_title}\n"
                                f"Snippet: {sanitized_snippet}\n"
                                f"Source: {safe_source}\n"
                                f"Retrieved at: {r.retrieved_at}"
                            ),
                            "source_name": safe_source,
                            "source_url": r.url,
                            "source_type": "live_web",
                            "is_live_web": True,
                            "retrieved_at": r.retrieved_at,
                            "image_url": r.image_url,
                            "category": r.category,
                            "fused_score": 1.0,  # Prioritize fresh results for temporal queries
                        })
                elif not live_response.live_search_available:
                    metadata["live_search_available"] = False
                    log.warning("serpapi_live_search_unavailable_falling_back_to_db")
            except Exception as e:
                log.error("live_search_execution_error", error=str(e))
                metadata["live_search_available"] = False

        # 1b. Retrieve Grounded Real-Time Places for Entities/Venues
        if not document_scope and (category in ["attraction", "restaurant", "hotel", "activity", "destination"] or is_live_needed):
            try:
                places_found = await places_service.search_places(
                    query=query,
                    category=category if category != "general" else None,
                    limit=3,
                    db=db,
                )
                for p in places_found:
                    live_docs.append({
                        "id": f"grounded-place-{p.id}",
                        "content": (
                            f"[VERIFIED GROUNDED PLACE - HIGH CONFIDENCE]\n"
                            f"Name: {p.name}\n"
                            f"Category: {p.category}\n"
                            f"Address: {p.address or p.city or 'N/A'}\n"
                            f"Rating: {p.rating or 'N/A'} ({p.review_count or 0} reviews)\n"
                            f"Opening Hours: {json.dumps(p.opening_hours) if p.opening_hours else 'Standard hours'}\n"
                            f"Amenities/Highlights: {', '.join(p.amenities or p.cuisine_types or p.activity_types or ['Featured location'])}\n"
                            f"Source: {p.source} (Verified Provider)"
                        ),
                        "source_name": f"{p.source.title()} — {p.name}",
                        "source_url": p.source_url or "",
                        "source_type": "verified_place",
                        "is_live_web": True,
                        "retrieved_at": datetime.now(timezone.utc).isoformat(),
                        "image_url": p.image_url,
                        "category": p.category,
                        "fused_score": 1.15,
                    })
            except Exception as pe:
                log.warning("places_grounding_error", error=str(pe))

        # 1c. Retrieve Grounded Hotel Catalog Records from 59,707 Hotel Dataset
        hotel_triggers = ["hotel", "hotels", "resort", "resorts", "stay", "stays", "accommodation", "inn", "hostel", "pool", "wifi", "parking", "room"]
        if not document_scope and (category == "hotel" or any(ht in query.lower() for ht in hotel_triggers)):
            try:
                hotel_docs = await self._retrieve_hotel_records(db=db, query=query, limit=5)
                live_docs.extend(hotel_docs)
            except Exception as he:
                log.warning("hotel_rag_grounding_error", error=str(he))

        # 2. Query rewriting for stable vector DB retrieval
        rewritten_query = await self._rewrite_query(query)

        # 3. Stable DB Retrieval (Semantic + Keyword)
        db_docs: List[Dict] = []
        try:
            query_embedding = await gemini_service.generate_embedding(
                rewritten_query,
                task_type="retrieval_query",
            )
            semantic_search = self._semantic_search(db, query_embedding, filters, top_k)
            keyword_search = self._keyword_search(db, rewritten_query, filters, top_k)

            # AsyncSession is not safe for concurrent operations. Run both
            # searches in sequence on the same session to avoid losing both
            # result sets to a session concurrency error.
            semantic_results = await semantic_search
            keyword_results = await keyword_search

            if isinstance(semantic_results, Exception):
                log.error("semantic_search_error", error=str(semantic_results))
                semantic_results = []
            if isinstance(keyword_results, Exception):
                log.error("keyword_search_error", error=str(keyword_results))
                keyword_results = []

            # Hybrid score fusion
            db_docs = self._reciprocal_rank_fusion(semantic_results, keyword_results)
        except Exception as e:
            log.warning("vector_db_retrieval_fallback", error=str(e))
            # Fall back to keyword only if embedding failed
            try:
                db_docs = await self._keyword_search(db, rewritten_query, filters, top_k)
            except Exception:
                db_docs = []

        # 4. Merge Live Web Results + DB Docs
        combined_docs = live_docs + db_docs

        # 5. Apply metadata filters if provided
        if filters:
            combined_docs = self._apply_filters(combined_docs, filters)

        # 6. Context Compression & Deduplication
        compressed = self._compress_context(combined_docs, query)[:top_k]

        # 7. Build Citations (preserving live web flags and timestamps)
        citations = self._build_citations(compressed, query)

        return compressed, citations, metadata

    def _sanitize_untrusted_web_content(self, text_content: str) -> str:
        """
        Neutralize potential prompt injection vectors in scraped web text:
        - Strip instruction injection patterns (e.g. 'Ignore previous instructions', 'System prompt:')
        - Strip excessive brackets or markup
        """
        if not text_content:
            return ""
        # Remove potential injection prefixes
        cleaned = re.sub(
            r"(?i)(ignore\s+all\s+previous\s+instructions|disregard\s+prior\s+rules|system\s*prompt:|you\s+are\s+now)",
            "[REDACTED_INSTRUCTION]",
            text_content,
        )
        return cleaned.strip()

    async def _rewrite_query(self, query: str) -> str:
        """Rewrite user query for better retrieval."""
        rewrites = {
            "places to eat": "restaurants food dining",
            "things to do": "activities attractions sightseeing experiences",
            "where to stay": "hotels accommodation lodging",
            "best time": "best time to visit season weather",
            "how much": "cost price budget estimate",
            "is it safe": "safety security crime",
        }
        q = query.lower()
        for original, expanded in rewrites.items():
            if original in q:
                q = q.replace(original, expanded)
        return q

    async def _semantic_search(
        self,
        db: AsyncSession,
        query_embedding: List[float],
        filters: Optional[Dict],
        limit: int,
    ) -> List[Dict]:
        """Vector similarity search using pgvector."""
        try:
            embedding_str = f"[{','.join(str(x) for x in query_embedding)}]"
            filter_sql, filter_params = self._build_metadata_filters(filters)
            query_sql = """
                SELECT
                    dc.id, dc.content, dc.chunk_metadata, dc.document_id,
                    d.source_name, d.source_url, d.source_type, d.country,
                    d.city, d.category, d.last_updated, d.language, d.access_scope, d.title,
                    1 - (dc.embedding <=> CAST(:embedding AS vector)) as similarity_score
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE dc.embedding IS NOT NULL AND d.is_active = true
            """ + filter_sql + """
                ORDER BY dc.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
            """
            params = {"embedding": embedding_str, "limit": limit, **filter_params}
            result = await db.execute(
                text(query_sql),
                params,
            )
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as e:
            log.error("semantic_search_error", error=str(e))
            return []

    async def _keyword_search(
        self,
        db: AsyncSession,
        query: str,
        filters: Optional[Dict],
        limit: int,
    ) -> List[Dict]:
        """Full-text keyword search using PostgreSQL tsvector."""
        try:
            filter_sql, filter_params = self._build_metadata_filters(filters)
            query_sql = """
                SELECT
                    dc.id, dc.content, dc.chunk_metadata, dc.document_id,
                    d.source_name, d.source_url, d.source_type, d.country,
                    d.city, d.category, d.last_updated, d.language, d.access_scope, d.title,
                    ts_rank(
                        to_tsvector('english', dc.content),
                        plainto_tsquery('english', :query)
                    ) as similarity_score
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE d.is_active = true
                  AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', :query)
            """ + filter_sql + """
                ORDER BY similarity_score DESC
                LIMIT :limit
            """
            params = {"query": query, "limit": limit, **filter_params}
            result = await db.execute(text(query_sql), params)
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as e:
            log.error("keyword_search_error", error=str(e))
            return []

    def _build_metadata_filters(
        self,
        filters: Optional[Dict],
    ) -> Tuple[str, Dict[str, Any]]:
        """Build bound SQL predicates for supported document metadata filters."""
        filters = filters or {}

        # Column names come only from this allowlist; values are always bound.
        supported_columns = {
            "country": "country",
            "category": "category",
            "language": "language",
        }
        clauses = []
        params: Dict[str, Any] = {}
        for key, column in supported_columns.items():
            value = filters.get(key)
            if value is not None:
                bind_name = f"rag_filter_{key}"
                clauses.append(f"AND d.{column} = :{bind_name}")
                params[bind_name] = value
        document_id = filters.get("document_id")
        if document_id:
            clauses.append("AND d.id = CAST(:rag_document_id AS uuid)")
            params["rag_document_id"] = str(document_id)
        # Private records are visible only to the authenticated owner. If no
        # owner is supplied, retrieval is global-only by default.
        owner_id = filters.get("owner_user_id")
        if owner_id:
            clauses.append("AND (d.access_scope = 'global' OR (d.access_scope = 'private' AND d.owner_id = :rag_owner_id))")
            params["rag_owner_id"] = owner_id
        else:
            clauses.append("AND COALESCE(d.access_scope, 'global') = 'global'")
        if not clauses:
            return "", {}
        return "\n                " + "\n                ".join(clauses), params

    def _reciprocal_rank_fusion(
        self,
        semantic_results: List[Dict],
        keyword_results: List[Dict],
        k: int = 60,
    ) -> List[Dict]:
        """Combine semantic and keyword results using Reciprocal Rank Fusion."""
        scores: Dict[str, float] = {}
        doc_map: Dict[str, Dict] = {}

        for rank, doc in enumerate(semantic_results):
            doc_id = str(doc["id"])
            rrf_score = SEMANTIC_WEIGHT / (k + rank + 1)
            scores[doc_id] = scores.get(doc_id, 0) + rrf_score
            doc_map[doc_id] = doc

        for rank, doc in enumerate(keyword_results):
            doc_id = str(doc["id"])
            rrf_score = KEYWORD_WEIGHT / (k + rank + 1)
            scores[doc_id] = scores.get(doc_id, 0) + rrf_score
            doc_map[doc_id] = doc

        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        results = []
        for doc_id in sorted_ids:
            doc = dict(doc_map[doc_id])
            doc["fused_score"] = scores[doc_id]
            results.append(doc)
        return results

    def _apply_filters(self, docs: List[Dict], filters: Dict) -> List[Dict]:
        """Post-retrieval metadata filtering."""
        filtered = []
        for doc in docs:
            match = True
            if filters.get("document_id") and str(doc.get("document_id") or "") != str(filters["document_id"]):
                match = False
            if filters.get("country") and doc.get("country") != filters["country"]:
                match = False
            if filters.get("category") and doc.get("category") != filters["category"]:
                match = False
            if filters.get("language") and doc.get("language") != filters["language"]:
                match = False
            if match:
                filtered.append(doc)
        return filtered

    def _compress_context(self, docs: List[Dict], query: str) -> List[Dict]:
        """Remove duplicate/near-duplicate content while preserving live web results."""
        seen_content = set()
        seen_urls = set()
        compressed = []

        for doc in docs:
            url = doc.get("source_url")
            content = doc.get("content", "")
            content_key = content[:150].lower()

            if url and url in seen_urls:
                continue
            if content_key in seen_content:
                continue

            if url:
                seen_urls.add(url)
            seen_content.add(content_key)
            compressed.append(doc)

        return compressed

    def _build_citations(self, docs: List[Dict], query: str = "") -> List[Dict]:
        """Build citation list from retrieved documents including live web sources."""
        citations = []
        seen_sources = set()

        for i, doc in enumerate(docs):
            source_key = doc.get("source_url") or doc.get("source_name", "")
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                citations.append({
                    "index": i + 1,
                    "source_name": doc.get("title") or doc.get("source_name", "Tourism Database"),
                    "source_url": doc.get("source_url"),
                    "source_type": "personal_document" if doc.get("access_scope") == "private" else doc.get("source_type", "database"),
                    "document_id": str(doc.get("document_id")) if doc.get("document_id") else None,
                    "document_scope": doc.get("access_scope", "global"),
                    "snippet": self._relevant_snippet(doc.get("content") or "", query),
                    "is_live_web": doc.get("is_live_web", False),
                    "retrieved_at": doc.get("retrieved_at"),
                    "image_url": doc.get("image_url"),
                    "country": doc.get("country"),
                    "last_updated": str(doc.get("last_updated") or doc.get("retrieved_at") or "Recent"),
                })
        return citations

    def _relevant_snippet(self, content: str, query: str, limit: int = 280) -> str:
        """Show the most query-relevant passage in a source card, not its opening text."""
        sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", content) if part.strip()]
        if not sentences or not query.strip():
            return content[:limit]

        stop_words = {"what", "when", "where", "which", "who", "how", "why", "should", "could", "would", "the", "and", "for", "from", "with", "about", "visit", "tell", "me", "please", "does", "do", "is", "are"}
        terms = {word for word in re.findall(r"[a-z0-9]+", query.lower()) if len(word) > 2 and word not in stop_words}
        asks_time = bool(re.search(r"\b(when|what time|how early|how late)\b", query.lower()))
        asks_why = bool(re.search(r"\bwhy\b", query.lower()))

        def score(sentence: str) -> int:
            lowered = sentence.lower()
            words = set(re.findall(r"[a-z0-9]+", lowered))
            value = len(terms & words)
            if asks_time and re.search(r"\b\d{1,2}(?::\d{2})?\s?(?:am|pm)?\b|\b(before|after|early|late|morning|afternoon|evening)\b", lowered):
                value += 3
            if asks_time and re.search(r"\bbest\b", lowered):
                value += 2
            if asks_why and re.search(r"\b(because|avoid|crowd\w*|quiet|since|so that|best)\b", lowered):
                value += 2
            return value

        ranked = sorted(enumerate(sentences), key=lambda item: score(item[1]), reverse=True)
        best_sentence = ranked[0][1] if ranked and score(ranked[0][1]) > 0 else ""
        snippet = best_sentence or content[:limit]
        return snippet[:limit].rstrip() + ("…" if len(snippet) > limit else "")

    async def _retrieve_hotel_records(self, db: AsyncSession, query: str, limit: int = 5) -> List[Dict]:
        """
        Extract relevant hotels from the 59,707 normalized catalog matching query parameters
        (city, country, amenities, pool, rating, price).
        """
        from app.models.models import Hotel
        from sqlalchemy import and_, or_
        q_lower = query.lower()

        stmt = select(Hotel)
        conditions = []

        # Check for pool
        if "pool" in q_lower or "swimming" in q_lower:
            conditions.append(Hotel.has_pool.is_(True))

        # Check for spa
        if "spa" in q_lower:
            conditions.append(Hotel.has_spa.is_(True))

        # Check for free wifi or parking
        if "free wifi" in q_lower or "wifi" in q_lower:
            conditions.append(Hotel.amenities.contains(["Free WiFi"]))
        if "parking" in q_lower:
            conditions.append(Hotel.amenities.contains(["Free parking"]))

        # Keyword matching against city, country, or name
        words = [w for w in re.findall(r"\b[a-zA-Z]{3,}\b", query) if w.lower() not in ["find", "the", "with", "and", "for", "hotel", "hotels", "best", "cheap", "affordable", "compare", "which", "recommend", "trip", "family"]]
        if words:
            word_conds = []
            for w in words:
                word_conds.append(Hotel.city.ilike(f"%{w}%"))
                word_conds.append(Hotel.country.ilike(f"%{w}%"))
                word_conds.append(Hotel.name.ilike(f"%{w}%"))
            conditions.append(or_(*word_conds))

        if conditions:
            stmt = stmt.where(and_(*conditions))

        if "affordable" in q_lower or "cheap" in q_lower or "budget" in q_lower:
            stmt = stmt.order_by(Hotel.price_per_night_min.asc().nullslast(), Hotel.avg_guest_rating.desc().nullslast())
        else:
            stmt = stmt.order_by(Hotel.avg_guest_rating.desc().nullslast(), Hotel.review_count.desc())

        stmt = stmt.limit(limit)
        res = await db.execute(stmt)
        hotels = res.scalars().all()

        docs = []
        for h in hotels:
            price_str = f"${h.price_per_night_min:.2f}" if h.price_per_night_min is not None else "Price unavailable"
            amenities_str = ", ".join(h.amenities or []) if h.amenities else "None listed"
            warnings_str = ", ".join(h.data_quality_flags or []) if h.data_quality_flags else "None"

            content = (
                f"[HOTEL CATALOG RECORD - STATIC REFERENCE DATA]\n"
                f"Hotel Name: {h.name}\n"
                f"City: {h.city or 'N/A'}, Country: {h.country or 'N/A'}\n"
                f"Rating: {h.avg_guest_rating or 'N/A'}/5.0 ({h.review_count or 0} reviews)\n"
                f"Price when available: {price_str}\n"
                f"Amenities: {amenities_str}\n"
                f"Has Pool: {'Yes' if h.has_pool else 'No'} | Has Spa: {'Yes' if h.has_spa else 'No'}\n"
                f"Source: {h.source or 'hotels.csv'}\n"
                f"Source Row: {h.source_row or 'N/A'}\n"
                f"Data-Quality Warnings: {warnings_str}\n"
                f"Notice: This is static catalog data. Live availability and confirmed pricing require real-time verification."
            )
            docs.append({
                "id": f"hotel-catalog-{h.id}",
                "content": content,
                "source_name": f"{h.name} ({h.city or 'Catalog'}, {h.country or ''})",
                "source_url": h.booking_url or "",
                "source_type": "hotel_catalog",
                "is_live_web": False,
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "image_url": h.image_url,
                "category": "hotel",
                "fused_score": 1.25,
            })
        return docs


class HotelRAGDocument:
    def __init__(self, hotel_id: str, document_text: str, metadata: Dict[str, Any]):
        self.hotel_id = hotel_id
        self.document_text = document_text
        self.metadata = metadata


def hotel_to_rag_document(hotel: Hotel) -> HotelRAGDocument:
    """Format a hotel model instance into a structured RAG document with quality warnings."""
    price_str = f"${hotel.price_per_night_min:.2f}/night" if hotel.price_per_night_min else "Price unavailable"
    amenities_str = ", ".join(hotel.amenities) if hotel.amenities else "None listed"
    warnings = hotel.data_quality_flags or []
    warnings_str = ", ".join(warnings) if warnings else "None"

    doc_text = (
        f"[HOTEL CATALOG RECORD - STATIC REFERENCE DATA]\n"
        f"Hotel Name: {hotel.name}\n"
        f"Location: {hotel.city or 'N/A'}, {hotel.country or 'N/A'}\n"
        f"Rating: {hotel.avg_guest_rating or 'Unrated'}/5 ({hotel.review_count or 0:,} verified reviews)\n"
        f"Price: {price_str}\n"
        f"Amenities: {amenities_str}\n"
        f"Features: Pool={'Yes' if hotel.has_pool else 'No'}, Spa={'Yes' if hotel.has_spa else 'No'}, "
        f"Family-Friendly={'Yes' if hotel.is_family_friendly else 'Unknown'}, "
        f"Pet-Friendly={'Yes' if hotel.is_pet_friendly else 'Unknown'}\n"
        f"Source: {hotel.source or 'hotels.csv'} (Row {hotel.source_row or 'N/A'})\n"
        f"Data-Quality Warnings: {warnings_str}\n"
        f"Verification Note: Static catalog entry - Live availability and final rate require verification."
    )
    return HotelRAGDocument(
        hotel_id=hotel.id,
        document_text=doc_text,
        metadata={
            "hotel_id": hotel.id,
            "name": hotel.name,
            "city": hotel.city,
            "country": hotel.country,
            "source": hotel.source,
            "source_row": hotel.source_row,
            "price": hotel.price_per_night_min,
            "rating": hotel.avg_guest_rating,
        },
    )


# Global singleton instance
rag_pipeline = RAGPipeline()
