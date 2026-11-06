"""
Live Search Service — Coordinates SerpApi retrieval with Redis caching,
deduplication, category-based query tuning, and graceful fallback.
"""
from __future__ import annotations
import hashlib
import json
import re
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
import structlog
import redis.asyncio as aioredis

from app.core.config import settings
from app.integrations.serpapi_client import (
    serpapi_client,
    SerpApiClient,
    SerpApiResponse,
    NormalizedSearchResult,
)

log = structlog.get_logger()

# Supported search domain categories
VALID_CATEGORIES = {
    "destination",
    "attraction",
    "hotel",
    "restaurant",
    "activity",
    "event",
    "guide",
    "general",
}


class LiveSearchService:
    """
    High-level live search service providing Redis-cached, deduplicated,
    and category-refined web search results.
    """

    def __init__(self, client: Optional[SerpApiClient] = None):
        self.client = client or serpapi_client
        self._redis_client: Optional[aioredis.Redis] = None
        self._memory_cache: Dict[str, Tuple[float, SerpApiResponse]] = {}
        self.cache_ttl = settings.SERPAPI_CACHE_TTL_SECONDS or 1800

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        """Lazy-connect to Redis with exception fallback."""
        if self._redis_client is None:
            try:
                self._redis_client = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=1.5,
                )
                # Quick ping to verify connectivity
                await self._redis_client.ping()
            except Exception as e:
                log.warning("redis_unavailable_using_memory_cache", error=str(e))
                self._redis_client = None
        return self._redis_client

    def generate_cache_key(
        self,
        query: str,
        location: Optional[str] = None,
        language: str = "en",
        country: str = "in",
        engine: Optional[str] = None,
        category: str = "general",
    ) -> str:
        """
        Generate normalized cache key based on:
        query + location + language + country + engine (+ category)
        """
        norm_q = query.strip().lower()
        norm_loc = (location or "").strip().lower()
        norm_lang = language.strip().lower()
        norm_country = country.strip().lower()
        norm_engine = (engine or settings.SERPAPI_ENGINE or "google").strip().lower()
        norm_cat = category.strip().lower()

        composite = f"q:{norm_q}|loc:{norm_loc}|hl:{norm_lang}|gl:{norm_country}|eng:{norm_engine}|cat:{norm_cat}"
        digest = hashlib.sha256(composite.encode("utf-8")).hexdigest()[:24]
        return f"serpapi:cache:{digest}"

    async def _get_cached_result(self, cache_key: str) -> Optional[SerpApiResponse]:
        """Retrieve from Redis or fallback in-memory cache."""
        # 1. Try Redis
        try:
            r = await self._get_redis()
            if r:
                cached_raw = await r.get(cache_key)
                if cached_raw:
                    data = json.loads(cached_raw)
                    response = SerpApiResponse(**data)
                    response.cached = True
                    log.debug("serpapi_redis_cache_hit", cache_key=cache_key)
                    return response
        except Exception as e:
            log.warning("redis_cache_read_error", error=str(e))

        # 2. Try in-memory fallback
        now = time.time()
        if cache_key in self._memory_cache:
            expires_at, response = self._memory_cache[cache_key]
            if now < expires_at:
                response.cached = True
                log.debug("serpapi_memory_cache_hit", cache_key=cache_key)
                return response
            else:
                del self._memory_cache[cache_key]

        return None

    async def _set_cached_result(self, cache_key: str, response: SerpApiResponse):
        """Store into Redis and in-memory fallback."""
        data_json = response.model_dump_json()

        # 1. Store in Redis
        try:
            r = await self._get_redis()
            if r:
                await r.set(cache_key, data_json, ex=self.cache_ttl)
                log.debug("serpapi_redis_cache_saved", cache_key=cache_key, ttl=self.cache_ttl)
        except Exception as e:
            log.warning("redis_cache_write_error", error=str(e))

        # 2. Store in memory fallback
        self._memory_cache[cache_key] = (time.time() + self.cache_ttl, response)

    def deduplicate_results(
        self, results: List[NormalizedSearchResult]
    ) -> List[NormalizedSearchResult]:
        """
        Deduplicate items by canonical URL (without tracking params) and normalized title.
        """
        seen_urls = set()
        seen_titles = set()
        unique: List[NormalizedSearchResult] = []

        for item in results:
            # Canonical URL (strip query/hash for dedup comparison)
            canonical_url = item.url.split("?")[0].rstrip("/").lower()
            norm_title = re.sub(r"\W+", "", item.title.lower())

            if canonical_url in seen_urls or norm_title in seen_titles:
                continue

            seen_urls.add(canonical_url)
            seen_titles.add(norm_title)
            unique.append(item)

        return unique

    def refine_query_for_category(
        self, query: str, category: str, location: Optional[str] = None
    ) -> str:
        """
        Augment search query depending on category and intent.
        """
        q = query.strip()
        cat = category.lower()

        # If location is given and not present in query, append it
        if location and location.lower() not in q.lower():
            q = f"{q} in {location}"

        if cat == "hotel" and "hotel" not in q.lower() and "stay" not in q.lower():
            q = f"best hotels accommodations {q}"
        elif cat == "restaurant" and "restaurant" not in q.lower() and "food" not in q.lower():
            q = f"best restaurants authentic dining {q}"
        elif cat == "attraction" and "attraction" not in q.lower() and "visit" not in q.lower():
            q = f"top sights attractions {q}"
        elif cat == "activity" and "activity" not in q.lower() and "things to do" not in q.lower():
            q = f"things to do activities experiences {q}"
        elif cat == "event" and "event" not in q.lower() and "festival" not in q.lower():
            q = f"upcoming events festivals {q}"
        elif cat == "guide" and "guide" not in q.lower() and "blog" not in q.lower():
            q = f"travel guide recommendations {q}"

        return q

    async def search_web(
        self,
        query: str,
        location: Optional[str] = None,
        language: str = "en",
        country: str = "in",
        engine: Optional[str] = None,
        num_results: int = 10,
        category: str = "general",
    ) -> SerpApiResponse:
        """
        Execute cached, deduplicated web search.
        Falls back gracefully with detailed status if SerpApi or Redis is offline.
        """
        category_clean = category if category in VALID_CATEGORIES else "general"

        # 1. Refine query based on domain category
        effective_query = self.refine_query_for_category(query, category_clean, location)

        # 2. Engine override based on category (e.g. google_maps for "near me" or addresses)
        effective_engine = engine or settings.SERPAPI_ENGINE or "google"
        if "near me" in query.lower() and effective_engine == "google":
            # For near me queries, Google local or standard web query with location is supported
            pass

        # 3. Check Cache
        cache_key = self.generate_cache_key(
            query=effective_query,
            location=location,
            language=language,
            country=country,
            engine=effective_engine,
            category=category_clean,
        )

        cached_response = await self._get_cached_result(cache_key)
        if cached_response is not None:
            return cached_response

        # 4. Fetch live results from SerpApi Client
        api_response = await self.client.search_web(
            query=effective_query,
            location=location,
            language=language,
            country=country,
            engine=effective_engine,
            num_results=num_results * 2,  # Fetch a few extra for deduplication
            category=category_clean,
        )

        if not api_response.live_search_available or api_response.error:
            # Return graceful response without caching errors
            return api_response

        # 5. Clean, normalize, and deduplicate
        deduped = self.deduplicate_results(api_response.results)
        final_results = deduped[:num_results]

        # Re-assign positions
        for i, item in enumerate(final_results):
            item.position = i + 1

        api_response.results = final_results

        # 6. Save to Cache
        if final_results:
            await self._set_cached_result(cache_key, api_response)

        return api_response

    # Method alias
    search = search_web


# Global singleton instance
live_search_service = LiveSearchService()
