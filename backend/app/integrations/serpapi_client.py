"""
SerpApi Client Integration — Backend-only secure client for Google/SerpApi search.
Handles live web search for tourism, destinations, hotels, restaurants, events, and guides.
NEVER logs or exposes the API key.
"""
from __future__ import annotations
import asyncio
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import httpx
from pydantic import BaseModel, Field
import structlog

from app.core.config import settings

log = structlog.get_logger()

SERPAPI_BASE_URL = "https://serpapi.com/search.json"


class NormalizedSearchResult(BaseModel):
    """Normalized search result format across all SerpApi search engines."""
    title: str
    url: str
    snippet: str = ""
    source: str = ""
    image_url: Optional[str] = None
    position: int = 1
    category: str = "general"
    retrieved_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SerpApiResponse(BaseModel):
    """Structured response container for live search."""
    query: str
    results: List[NormalizedSearchResult] = []
    source: str = "serpapi"
    cached: bool = False
    engine: str = "google"
    live_search_available: bool = True
    error: Optional[str] = None


class SerpApiClient:
    """
    Reusable asynchronous client for SerpApi with exponential backoff retries,
    rate-limit handling, query sanitization, and graceful fallback.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_engine: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.api_key = api_key or settings.SERPAPI_API_KEY
        self.default_engine = default_engine or settings.SERPAPI_ENGINE or "google"
        self.timeout_seconds = timeout_seconds or settings.SERPAPI_TIMEOUT_SECONDS or 15

    def is_configured(self) -> bool:
        """Check if SerpApi key is provided and non-empty."""
        return bool(self.api_key and self.api_key.strip() and not self.api_key.startswith("your_"))

    def sanitize_query(self, query: str, max_length: int = 250) -> str:
        """
        Sanitize and validate user query:
        - Strip control characters
        - Collapse consecutive whitespace
        - Enforce maximum length limit
        """
        if not query:
            return ""
        # Remove null bytes and control chars
        cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", query)
        # Collapse multiple spaces
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned[:max_length]

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
        Execute a search using SerpApi with retries and exponential backoff.

        Parameters:
        - query: Search terms (e.g. "hidden gems in Kerala")
        - location: Geographical location string (e.g. "Kerala, India")
        - language: Language code (e.g. "en")
        - country: Two-letter country code (e.g. "in")
        - engine: Specific SerpApi engine (google, google_maps, google_hotels, google_flights, etc.)
        - num_results: Maximum items to return
        - category: Search domain category (destination, attraction, hotel, restaurant, activity, event, guide)
        """
        sanitized_query = self.sanitize_query(query)
        target_engine = engine or self.default_engine or "google"

        if not sanitized_query:
            return SerpApiResponse(
                query=query,
                results=[],
                engine=target_engine,
                error="Empty or invalid query",
            )

        if not self.is_configured():
            log.warning("serpapi_not_configured", query=sanitized_query[:40])
            return SerpApiResponse(
                query=sanitized_query,
                results=[],
                engine=target_engine,
                live_search_available=False,
                error="SerpApi is not configured with an API key",
            )

        # Build query parameters
        params: Dict[str, Any] = {
            "api_key": self.api_key,
            "engine": target_engine,
            "q": sanitized_query,
            "hl": language,
            "gl": country,
            "num": min(max(num_results, 1), 20),
            "output": "json",
        }

        if location:
            params["location"] = location.strip()

        # Execute with exponential backoff for transient failures (max 3 attempts)
        max_retries = 3
        backoff_delays = [0.5, 1.5, 3.0]
        raw_data = None
        last_error = None

        async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout_seconds)) as client:
            for attempt in range(max_retries):
                try:
                    log.info(
                        "serpapi_request_start",
                        engine=target_engine,
                        query_length=len(sanitized_query),
                        location=location,
                        attempt=attempt + 1,
                    )
                    response = await client.get(SERPAPI_BASE_URL, params=params)

                    if response.status_code == 200:
                        raw_data = response.json()
                        break
                    elif response.status_code == 429:
                        log.warning("serpapi_rate_limited", attempt=attempt + 1)
                        last_error = "Rate limit exceeded (HTTP 429)"
                        if attempt < max_retries - 1:
                            await asyncio.sleep(backoff_delays[attempt])
                            continue
                    elif response.status_code in (502, 503, 504):
                        log.warning(
                            "serpapi_gateway_error",
                            status_code=response.status_code,
                            attempt=attempt + 1,
                        )
                        last_error = f"SerpApi temporary upstream error ({response.status_code})"
                        if attempt < max_retries - 1:
                            await asyncio.sleep(backoff_delays[attempt])
                            continue
                    else:
                        error_detail = response.text[:200]
                        log.error(
                            "serpapi_http_error",
                            status_code=response.status_code,
                            detail=error_detail,
                        )
                        last_error = f"SerpApi HTTP {response.status_code}"
                        break

                except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as exc:
                    log.warning("serpapi_timeout", attempt=attempt + 1, error=str(exc))
                    last_error = "SerpApi request timed out"
                    if attempt < max_retries - 1:
                        await asyncio.sleep(backoff_delays[attempt])
                        continue
                except httpx.RequestError as exc:
                    log.error("serpapi_connection_error", attempt=attempt + 1, error=str(exc))
                    last_error = "SerpApi connection failure"
                    if attempt < max_retries - 1:
                        await asyncio.sleep(backoff_delays[attempt])
                        continue
                except Exception as exc:
                    log.error("serpapi_unexpected_error", error=str(exc))
                    last_error = f"Unexpected error: {str(exc)}"
                    break

        if raw_data is None:
            return SerpApiResponse(
                query=sanitized_query,
                results=[],
                engine=target_engine,
                live_search_available=False,
                error=last_error or "Failed to retrieve results from SerpApi",
            )

        # Parse and normalize results
        normalized_results = self._normalize_serpapi_payload(
            raw_data=raw_data,
            category=category,
            max_results=num_results,
        )

        log.info(
            "serpapi_request_success",
            engine=target_engine,
            count=len(normalized_results),
        )

        return SerpApiResponse(
            query=sanitized_query,
            results=normalized_results,
            engine=target_engine,
            cached=False,
            live_search_available=True,
        )

    def _normalize_serpapi_payload(
        self,
        raw_data: Dict[str, Any],
        category: str = "general",
        max_results: int = 10,
    ) -> List[NormalizedSearchResult]:
        """
        Extract and normalize organic results, local map results, events, and hotels into standard schema.
        """
        results: List[NormalizedSearchResult] = []
        position = 1
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Check Organic Results
        organic = raw_data.get("organic_results", [])
        if isinstance(organic, list):
            for item in organic:
                if not isinstance(item, dict):
                    continue
                title = item.get("title") or item.get("snippet", "")
                link = item.get("link")
                snippet = item.get("snippet") or item.get("description", "")
                source = item.get("source") or item.get("displayed_link", "")

                # Extract thumbnail/image if present
                image_url = None
                thumbnail = item.get("thumbnail")
                if isinstance(thumbnail, str):
                    image_url = thumbnail
                elif isinstance(item.get("thumbnail"), dict):
                    image_url = item["thumbnail"].get("src")
                elif item.get("pagemap", {}).get("cse_image"):
                    cse_images = item["pagemap"]["cse_image"]
                    if isinstance(cse_images, list) and cse_images:
                        image_url = cse_images[0].get("src")

                if link and title:
                    results.append(
                        NormalizedSearchResult(
                            title=title.strip(),
                            url=link.strip(),
                            snippet=snippet.strip(),
                            source=source.strip() if source else self._extract_domain(link),
                            image_url=image_url,
                            position=position,
                            category=category,
                            retrieved_at=now_iso,
                        )
                    )
                    position += 1

        # 2. Check Local Results / Places (e.g. for attractions, restaurants, hotels, maps)
        local_results = raw_data.get("local_results", {})
        places = []
        if isinstance(local_results, dict):
            places = local_results.get("places", [])
        elif isinstance(local_results, list):
            places = local_results

        for place in places:
            if not isinstance(place, dict):
                continue
            title = place.get("title") or place.get("name")
            link = place.get("link") or place.get("website")
            rating = place.get("rating")
            reviews = place.get("reviews")
            description = place.get("description") or place.get("type", "")
            address = place.get("address", "")
            snippet_parts = []
            if description:
                snippet_parts.append(description)
            if rating:
                snippet_parts.append(f"Rating: {rating}★ ({reviews or ''} reviews)")
            if address:
                snippet_parts.append(address)

            snippet = " · ".join(snippet_parts)
            image_url = place.get("thumbnail")

            if title and (link or place.get("place_id")):
                results.append(
                    NormalizedSearchResult(
                        title=title.strip(),
                        url=link.strip() if link else f"https://www.google.com/maps/search/?api=1&query={title}",
                        snippet=snippet,
                        source="Google Maps / Local",
                        image_url=image_url,
                        position=position,
                        category="attraction" if category == "general" else category,
                        retrieved_at=now_iso,
                    )
                )
                position += 1

        # 3. Check Events (if local events query)
        events_results = raw_data.get("events_results", [])
        if isinstance(events_results, list):
            for event in events_results:
                if not isinstance(event, dict):
                    continue
                title = event.get("title")
                link = event.get("link")
                date_info = event.get("date", {})
                date_str = date_info.get("when", "") if isinstance(date_info, dict) else str(date_info)
                venue = event.get("venue", {}).get("name", "") if isinstance(event.get("venue"), dict) else ""
                snippet = f"Date: {date_str}. Venue: {venue}. {event.get('description', '')}"

                if title:
                    results.append(
                        NormalizedSearchResult(
                            title=title.strip(),
                            url=link.strip() if link else "https://www.google.com",
                            snippet=snippet.strip(),
                            source="Local Events",
                            image_url=event.get("thumbnail"),
                            position=position,
                            category="events",
                            retrieved_at=now_iso,
                        )
                    )
                    position += 1

        # 4. Check Knowledge Graph (e.g. for destinations or famous sights)
        knowledge_graph = raw_data.get("knowledge_graph", {})
        if isinstance(knowledge_graph, dict) and knowledge_graph.get("title"):
            kg_title = knowledge_graph.get("title", "")
            kg_desc = knowledge_graph.get("description", "")
            kg_source = knowledge_graph.get("source", {}).get("name", "Google Knowledge Graph")
            kg_link = knowledge_graph.get("source", {}).get("link") or knowledge_graph.get("website")
            kg_image = knowledge_graph.get("header_images", [{}])[0].get("image") if knowledge_graph.get("header_images") else None

            if kg_title and (kg_desc or kg_link):
                # Prepend knowledge graph as position 1
                results.insert(
                    0,
                    NormalizedSearchResult(
                        title=kg_title.strip(),
                        url=kg_link or f"https://www.google.com/search?q={kg_title}",
                        snippet=kg_desc.strip(),
                        source=kg_source,
                        image_url=kg_image,
                        position=1,
                        category=category,
                        retrieved_at=now_iso,
                    ),
                )

        # 5. Check Hotels Results (if google_hotels engine was used)
        properties = raw_data.get("properties", [])
        if isinstance(properties, list):
            for prop in properties:
                if not isinstance(prop, dict):
                    continue
                name = prop.get("name")
                link = prop.get("link")
                rate = prop.get("rate_per_night", {}).get("lowest", "")
                rating = prop.get("overall_rating")
                snippet = f"Hotel · Lowest rate: {rate} · Rating: {rating}★" if rate else "Hotel accommodation"
                images = prop.get("images", [])
                image_url = images[0].get("thumbnail") if images and isinstance(images[0], dict) else None

                if name:
                    results.append(
                        NormalizedSearchResult(
                            title=name.strip(),
                            url=link.strip() if link else f"https://www.google.com/travel/hotels?q={name}",
                            snippet=snippet,
                            source="Google Hotels",
                            image_url=image_url,
                            position=position,
                            category="hotel",
                            retrieved_at=now_iso,
                        )
                    )
                    position += 1

        # Trim to requested limit
        return results[:max_results]

    @staticmethod
    def _extract_domain(url: str) -> str:
        """Extract clean human-friendly source domain from URL."""
        try:
            match = re.search(r"https?://(?:www\.)?([^/]+)", url)
            return match.group(1) if match else "Web"
        except Exception:
            return "Web"


# Global singleton instance
serpapi_client = SerpApiClient()
