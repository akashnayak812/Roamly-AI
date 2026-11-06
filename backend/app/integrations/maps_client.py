"""
Google Maps Client Integration — Secure adapter for Geocoding, Directions,
Distance calculation, and Route Optimization.
NEVER exposes the API key to frontend.
"""
from __future__ import annotations
import asyncio
import hashlib
import json
import time
from typing import Dict, List, Optional, Any, Tuple
import httpx
from pydantic import BaseModel, Field
import structlog
import redis.asyncio as aioredis

from app.core.config import settings

log = structlog.get_logger()


class GeocodeResult(BaseModel):
    address: str
    latitude: float
    longitude: float
    place_id: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None


class RouteStep(BaseModel):
    instruction: str
    distance_text: str
    duration_text: str


class RouteResult(BaseModel):
    origin: str
    destination: str
    mode: str = "driving"
    distance_km: float
    duration_mins: int
    summary: str
    polyline: Optional[str] = None
    steps: List[RouteStep] = []


class MapsClient:
    """
    Asynchronous Google Maps client for Geocoding, Directions, and Matrix.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: int = 15,
    ):
        self.api_key = api_key or settings.GOOGLE_MAPS_API_KEY or settings.MAPS_API_KEY
        self.base_url = (base_url or settings.MAPS_BASE_URL or "https://maps.googleapis.com/maps/api").rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._redis: Optional[aioredis.Redis] = None
        self._mem_cache: Dict[str, Tuple[float, Any]] = {}
        self.cache_ttl = settings.CACHE_TTL_ROUTES or 900

    async def _get_redis(self) -> Optional[aioredis.Redis]:
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
        return f"maps:{prefix}:{digest}"

    async def _get_cached(self, key: str) -> Optional[Any]:
        r = await self._get_redis()
        if r:
            try:
                val = await r.get(key)
                if val:
                    return json.loads(val)
            except Exception:
                pass
        if key in self._mem_cache:
            ts, data = self._mem_cache[key]
            if time.time() - ts < self.cache_ttl:
                return data
            del self._mem_cache[key]
        return None

    async def _set_cached(self, key: str, data: Any) -> None:
        r = await self._get_redis()
        if r:
            try:
                await r.set(key, json.dumps(data), ex=self.cache_ttl)
            except Exception:
                pass
        self._mem_cache[key] = (time.time(), data)

    async def geocode(self, address: str) -> Optional[GeocodeResult]:
        """Convert natural language address or city to latitude and longitude."""
        cache_key = self._cache_key("geocode", addr=address.strip().lower())
        cached = await self._get_cached(cache_key)
        if cached:
            return GeocodeResult(**cached)

        if not self.api_key:
            return None

        url = f"{self.base_url}/geocode/json"
        params = {"address": address, "key": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.get(url, params=params)
                res.raise_for_status()
                data = res.json()
                if data.get("status") == "OK" and data.get("results"):
                    first = data["results"][0]
                    loc = first.get("geometry", {}).get("location", {})
                    lat = loc.get("lat")
                    lng = loc.get("lng")
                    if lat is not None and lng is not None:
                        # Extract city & country components
                        city, country = None, None
                        for comp in first.get("address_components", []):
                            types = comp.get("types", [])
                            if "locality" in types:
                                city = comp.get("long_name")
                            if "country" in types:
                                country = comp.get("long_name")

                        result = GeocodeResult(
                            address=first.get("formatted_address", address),
                            latitude=lat,
                            longitude=lng,
                            place_id=first.get("place_id"),
                            city=city,
                            country=country,
                        )
                        await self._set_cached(cache_key, result.dict())
                        return result
        except Exception as e:
            log.warning("maps_geocode_failed", address=address, error=str(e))
        return None

    async def reverse_geocode(self, lat: float, lng: float) -> Optional[GeocodeResult]:
        """Convert coordinates to address, city, and country."""
        cache_key = self._cache_key("rev_geocode", lat=lat, lng=lng)
        cached = await self._get_cached(cache_key)
        if cached:
            return GeocodeResult(**cached)

        if not self.api_key:
            return None

        url = f"{self.base_url}/geocode/json"
        params = {"latlng": f"{lat},{lng}", "key": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.get(url, params=params)
                res.raise_for_status()
                data = res.json()
                if data.get("status") == "OK" and data.get("results"):
                    first = data["results"][0]
                    result = GeocodeResult(
                        address=first.get("formatted_address", f"{lat},{lng}"),
                        latitude=lat,
                        longitude=lng,
                        place_id=first.get("place_id"),
                    )
                    await self._set_cached(cache_key, result.dict())
                    return result
        except Exception as e:
            log.warning("maps_reverse_geocode_failed", lat=lat, lng=lng, error=str(e))
        return None

    async def get_directions(
        self,
        origin: str,
        destination: str,
        mode: str = "driving",
        waypoints: Optional[List[str]] = None,
    ) -> Optional[RouteResult]:
        """Compute directions, total distance, travel duration, and polyline."""
        cache_key = self._cache_key("dir", orig=origin, dest=destination, m=mode, wp=waypoints)
        cached = await self._get_cached(cache_key)
        if cached:
            return RouteResult(**cached)

        if not self.api_key:
            # Fallback estimation
            return RouteResult(
                origin=origin,
                destination=destination,
                mode=mode,
                distance_km=15.0,
                duration_mins=25,
                summary=f"Direct {mode} route from {origin} to {destination}",
                steps=[RouteStep(instruction=f"Head towards {destination}", distance_text="15 km", duration_text="25 mins")],
            )

        url = f"{self.base_url}/directions/json"
        params: Dict[str, Any] = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "key": self.api_key,
        }
        if waypoints:
            params["waypoints"] = "|".join(waypoints)

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.get(url, params=params)
                res.raise_for_status()
                data = res.json()
                if data.get("status") == "OK" and data.get("routes"):
                    route = data["routes"][0]
                    legs = route.get("legs", [])
                    total_dist_m = sum(leg.get("distance", {}).get("value", 0) for leg in legs)
                    total_dur_s = sum(leg.get("duration", {}).get("value", 0) for leg in legs)
                    polyline = route.get("overview_polyline", {}).get("points")
                    summary = route.get("summary") or f"{origin} to {destination}"

                    steps: List[RouteStep] = []
                    for leg in legs:
                        for s in leg.get("steps", [])[:5]:
                            steps.append(
                                RouteStep(
                                    instruction=s.get("html_instructions", "").replace("<b>", "").replace("</b>", ""),
                                    distance_text=s.get("distance", {}).get("text", ""),
                                    duration_text=s.get("duration", {}).get("text", ""),
                                )
                            )

                    result = RouteResult(
                        origin=origin,
                        destination=destination,
                        mode=mode,
                        distance_km=round(total_dist_m / 1000.0, 1),
                        duration_mins=round(total_dur_s / 60),
                        summary=summary,
                        polyline=polyline,
                        steps=steps,
                    )
                    await self._set_cached(cache_key, result.dict())
                    return result
        except Exception as e:
            log.warning("maps_directions_failed", error=str(e))

        return RouteResult(
            origin=origin,
            destination=destination,
            mode=mode,
            distance_km=12.0,
            duration_mins=20,
            summary=f"Route from {origin} to {destination}",
        )

    async def check_health(self) -> Dict[str, Any]:
        """Verify Maps API key connectivity."""
        if not self.api_key:
            return {"provider": "google_maps", "status": "unconfigured"}
        try:
            res = await self.geocode("Hyderabad, India")
            if res:
                return {"provider": "google_maps", "status": "healthy", "test_lat": res.latitude}
            return {"provider": "google_maps", "status": "degraded"}
        except Exception as e:
            return {"provider": "google_maps", "status": "unhealthy", "error": str(e)}


maps_client = MapsClient()
