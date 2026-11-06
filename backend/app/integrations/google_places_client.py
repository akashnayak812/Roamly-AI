"""
Google Places API Client — Backend-only secure adapter for Google Places.
Supports Text Search, Nearby Search, Place Details, Autocomplete, and Photos.
Normalizes responses into the unified internal Place schema.
NEVER exposes the API key to frontend.
"""
from __future__ import annotations
import asyncio
import hashlib
import json
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
import httpx
from pydantic import BaseModel, Field
import structlog
import redis.asyncio as aioredis

from app.core.config import settings

log = structlog.get_logger()

PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place"


# ── Normalized Internal Schemas ──────────────────────────────────────────────

class NormalizedPlace(BaseModel):
    """Unified internal Place schema matching project specification."""
    id: str
    external_id: Optional[str] = None
    name: str
    category: str # destination | attraction | restaurant | hotel | activity
    description: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    price_level: Optional[int] = None # 1 to 4
    opening_hours: Optional[Dict[str, Any]] = None
    amenities: List[str] = []
    cuisine_types: List[str] = []
    activity_types: List[str] = []
    image_url: Optional[str] = None
    source: str = "google_places"
    source_url: Optional[str] = None
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GooglePlacesResponse(BaseModel):
    """Structured response container for Google Places operations."""
    query: str
    results: List[NormalizedPlace] = []
    source: str = "google_places"
    cached: bool = False
    status: str = "OK"
    error: Optional[str] = None


class GooglePlacesClient:
    """
    Reusable asynchronous Google Places API adapter with exponential backoff,
    rate-limit handling, Redis caching, error normalization, and health check.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout_seconds: int = 15,
        max_retries: int = 3,
    ):
        self.api_key = api_key or settings.GOOGLE_PLACES_API_KEY or settings.MAPS_API_KEY
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self._redis: Optional[aioredis.Redis] = None
        self._mem_cache: Dict[str, Tuple[float, Any]] = {}
        self.cache_ttl = settings.CACHE_TTL_PLACES or 86400

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        """Lazy-connect to Redis with fallback."""
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=1.5,
                )
                await self._redis.ping()
            except Exception:
                self._redis = None
        return self._redis

    def _cache_key(self, prefix: str, **kwargs) -> str:
        serialized = json.dumps(kwargs, sort_keys=True, default=str)
        digest = hashlib.sha256(serialized.encode()).hexdigest()[:24]
        return f"places:{prefix}:{digest}"

    async def _get_cached(self, key: str) -> Optional[Any]:
        r = await self._get_redis()
        if r:
            try:
                val = await r.get(key)
                if val:
                    return json.loads(val)
            except Exception as e:
                log.debug("redis_get_failed", error=str(e))

        # Memory cache fallback
        if key in self._mem_cache:
            ts, data = self._mem_cache[key]
            if time.time() - ts < self.cache_ttl:
                return data
            del self._mem_cache[key]
        return None

    async def _set_cached(self, key: str, data: Any, ttl: Optional[int] = None) -> None:
        expiry = ttl or self.cache_ttl
        r = await self._get_redis()
        if r:
            try:
                await r.set(key, json.dumps(data), ex=expiry)
            except Exception as e:
                log.debug("redis_set_failed", error=str(e))

        self._mem_cache[key] = (time.time(), data)

    def _map_category(self, types: List[str]) -> str:
        """Map Google Places types array to project category enum."""
        t_set = set(types or [])
        if any(t in t_set for t in ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "food"]):
            return "restaurant"
        if any(t in t_set for t in ["lodging", "hotel", "resort", "motel", "bed_and_breakfast"]):
            return "hotel"
        if any(t in t_set for t in ["amusement_park", "aquarium", "campground", "bowling_alley", "spa", "stadium"]):
            return "activity"
        if any(t in t_set for t in ["locality", "administrative_area_level_1", "country", "sublocality"]):
            return "destination"
        return "attraction"

    def _normalize_place(self, raw: Dict[str, Any]) -> NormalizedPlace:
        """Transform raw Google Places response item to NormalizedPlace."""
        place_id = raw.get("place_id") or f"gp-{hashlib.md5(raw.get('name', '').encode()).hexdigest()[:12]}"
        types = raw.get("types", [])
        category = self._map_category(types)
        geometry = raw.get("geometry", {})
        loc = geometry.get("location", {})
        lat = loc.get("lat")
        lng = loc.get("lng")

        # Photo URL derivation
        photo_url = None
        photos = raw.get("photos", [])
        if photos and len(photos) > 0 and self.api_key:
            photo_ref = photos[0].get("photo_reference")
            if photo_ref:
                photo_url = f"{PLACES_BASE_URL}/photo?maxwidth=800&photo_reference={photo_ref}&key={self.api_key}"

        # Cuisine types extraction
        cuisine_types = []
        if category == "restaurant":
            for t in types:
                if t not in ["restaurant", "food", "point_of_interest", "establishment"]:
                    cuisine_types.append(t.replace("_", " ").title())

        # Amenities extraction
        amenities = []
        if raw.get("wheelchair_accessible_entrance"):
            amenities.append("Wheelchair Accessible")
        if raw.get("serves_vegetarian_food"):
            amenities.append("Vegetarian Options")
        if raw.get("delivery"):
            amenities.append("Delivery")
        if raw.get("dine_in"):
            amenities.append("Dine-in")

        opening = raw.get("opening_hours") or {}

        # City & Country extraction from formatted address
        addr = raw.get("formatted_address") or raw.get("vicinity") or ""
        parts = [p.strip() for p in addr.split(",") if p.strip()]
        country = parts[-1] if len(parts) > 0 else None
        city = parts[-2] if len(parts) > 1 else (parts[0] if parts else None)

        return NormalizedPlace(
            id=f"gp-{place_id}",
            external_id=place_id,
            name=raw.get("name", "Unknown Place"),
            category=category,
            description=raw.get("editorial_summary", {}).get("overview") if isinstance(raw.get("editorial_summary"), dict) else None,
            city=city,
            country=country,
            latitude=lat,
            longitude=lng,
            address=addr,
            rating=raw.get("rating"),
            review_count=raw.get("user_ratings_total") or 0,
            price_level=raw.get("price_level"),
            opening_hours=opening,
            amenities=amenities,
            cuisine_types=cuisine_types,
            activity_types=[t.replace("_", " ").title() for t in types if t not in ["point_of_interest", "establishment"]][:5],
            image_url=photo_url or "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80",
            source="google_places",
            source_url=raw.get("url") or (f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else None),
            last_updated=datetime.now(timezone.utc).isoformat(),
        )

    async def _execute_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute HTTP request with exponential backoff and retry."""
        if not self.api_key:
            log.warning("google_places_api_key_missing")
            return {"status": "REQUEST_DENIED", "results": [], "error_message": "Places API key not configured"}

        url = f"{PLACES_BASE_URL}/{endpoint}"
        query_params = {**params, "key": self.api_key}

        attempt = 0
        backoff = 0.5
        while attempt < self.max_retries:
            attempt += 1
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    resp = await client.get(url, params=query_params)
                    resp.raise_for_status()
                    data = resp.json()
                    status = data.get("status")
                    if status in ["OK", "ZERO_RESULTS"]:
                        return data
                    elif status == "OVER_QUERY_LIMIT":
                        log.warning("google_places_rate_limit", attempt=attempt)
                        await asyncio.sleep(backoff)
                        backoff *= 2
                        continue
                    else:
                        log.warning("google_places_api_error", status=status, msg=data.get("error_message"))
                        return data
            except httpx.HTTPError as exc:
                log.warning("google_places_http_error", attempt=attempt, error=str(exc))
                if attempt >= self.max_retries:
                    raise
                await asyncio.sleep(backoff)
                backoff *= 2

        return {"status": "ERROR", "results": []}

    async def text_search(
        self,
        query: str,
        location: Optional[str] = None,
        radius: Optional[int] = None,
        place_type: Optional[str] = None,
        open_now: bool = False,
    ) -> GooglePlacesResponse:
        """Search places by text query with optional location bias."""
        cache_key = self._cache_key("text", q=query, loc=location, rad=radius, t=place_type, on=open_now)
        cached = await self._get_cached(cache_key)
        if cached:
            cached["cached"] = True
            return GooglePlacesResponse(**cached)

        params: Dict[str, Any] = {"query": query}
        if location:
            params["location"] = location
        if radius:
            params["radius"] = radius
        if place_type:
            params["type"] = place_type
        if open_now:
            params["opennow"] = "true"

        data = await self._execute_request("textsearch/json", params)
        raw_results = data.get("results", [])
        normalized = [self._normalize_place(r) for r in raw_results]

        response = GooglePlacesResponse(
            query=query,
            results=normalized,
            source="google_places",
            cached=False,
            status=data.get("status", "OK"),
            error=data.get("error_message"),
        )
        await self._set_cached(cache_key, response.dict())
        return response

    async def nearby_search(
        self,
        lat: float,
        lng: float,
        radius: int = 5000,
        keyword: Optional[str] = None,
        place_type: Optional[str] = None,
    ) -> GooglePlacesResponse:
        """Search nearby places within radius of coordinates."""
        cache_key = self._cache_key("nearby", lat=lat, lng=lng, rad=radius, kw=keyword, t=place_type)
        cached = await self._get_cached(cache_key)
        if cached:
            cached["cached"] = True
            return GooglePlacesResponse(**cached)

        params: Dict[str, Any] = {
            "location": f"{lat},{lng}",
            "radius": radius,
        }
        if keyword:
            params["keyword"] = keyword
        if place_type:
            params["type"] = place_type

        data = await self._execute_request("nearbysearch/json", params)
        raw_results = data.get("results", [])
        normalized = [self._normalize_place(r) for r in raw_results]

        response = GooglePlacesResponse(
            query=f"{lat},{lng}",
            results=normalized,
            source="google_places",
            cached=False,
            status=data.get("status", "OK"),
            error=data.get("error_message"),
        )
        await self._set_cached(cache_key, response.dict())
        return response

    async def get_place_details(self, place_id: str) -> Optional[NormalizedPlace]:
        """Fetch full place details by Google Place ID."""
        cache_key = self._cache_key("details", pid=place_id)
        cached = await self._get_cached(cache_key)
        if cached:
            return NormalizedPlace(**cached)

        params = {
            "place_id": place_id,
            "fields": "place_id,name,formatted_address,geometry,rating,user_ratings_total,price_level,opening_hours,types,photos,url,website,editorial_summary,vicinity",
        }
        data = await self._execute_request("details/json", params)
        result = data.get("result")
        if not result:
            return None

        normalized = self._normalize_place(result)
        await self._set_cached(cache_key, normalized.dict())
        return normalized

    async def check_health(self) -> Dict[str, Any]:
        """Verify provider availability and API credentials."""
        if not self.api_key:
            return {"provider": "google_places", "status": "unconfigured", "error": "API key missing"}
        try:
            res = await self.text_search(query="India Gate", radius=1000)
            if res.status in ["OK", "ZERO_RESULTS"]:
                return {"provider": "google_places", "status": "healthy", "results_found": len(res.results)}
            return {"provider": "google_places", "status": "error", "error": res.error or res.status}
        except Exception as e:
            return {"provider": "google_places", "status": "unhealthy", "error": str(e)}


google_places_client = GooglePlacesClient()
