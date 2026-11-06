"""Places API — single place details and nearby place search."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import structlog

from app.db.database import get_db
from app.services.places_service import places_service
from app.integrations.google_places_client import NormalizedPlace

router = APIRouter()
log = structlog.get_logger()


@router.get("/photo")
async def get_place_photo(photo_reference: str = Query(..., min_length=10, max_length=500)):
    """Proxy Google Place photos so the server API key is never sent to browsers."""
    client = places_service.places_client
    if not client.api_key:
        raise HTTPException(status_code=503, detail="Place photos are not configured")
    url = "https://maps.googleapis.com/maps/api/place/photo"
    params = {"maxwidth": 1000, "photo_reference": photo_reference, "key": client.api_key}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            image = await http.get(url, params=params)
        if image.status_code != 200 or not image.headers.get("content-type", "").startswith("image/"):
            raise HTTPException(status_code=404, detail="Place photo is unavailable")
        return Response(
            content=image.content,
            media_type=image.headers["content-type"],
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        log.warning("place_photo_proxy_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="Could not load place photo") from exc


@router.get("/nearby", response_model=List[NormalizedPlace])
async def get_nearby_places(
    lat: float = Query(..., description="Latitude of center point"),
    lng: float = Query(..., description="Longitude of center point"),
    radius_km: float = Query(5.0, ge=0.5, le=50.0, description="Search radius in kilometers"),
    category: Optional[str] = Query(None, description="Category filter (attraction, restaurant, hotel, activity)"),
    limit: int = Query(15, ge=1, le=50, description="Max results count"),
):
    """
    Search nearby points of interest within radius of coordinates.
    Merges live Google Places nearby search with local database records.
    """
    try:
        places = await places_service.get_nearby_places(
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            category=category,
            limit=limit,
        )
        return places
    except Exception as exc:
        log.error("places_nearby_error", lat=lat, lng=lng, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch nearby places")


@router.get("/{place_id}", response_model=NormalizedPlace)
async def get_place_details(
    place_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch comprehensive details for a specific place by internal or external ID.
    Supports internal UUID, Google Places Place ID, or dataset identifier.
    """
    try:
        place = await places_service.get_place_by_id(place_id=place_id, db=db)
        if not place:
            raise HTTPException(status_code=404, detail="Place not found")
        return place
    except HTTPException:
        raise
    except Exception as exc:
        log.error("place_details_error", place_id=place_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to retrieve place details")
