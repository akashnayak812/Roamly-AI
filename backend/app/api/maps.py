"""Maps API — proxy for Google Maps to protect API keys and provide route computations."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
import httpx
from app.core.config import settings
from app.integrations.maps_client import maps_client, RouteResult, GeocodeResult

router = APIRouter()


@router.get("/route", response_model=RouteResult)
async def get_route(
    origin: str = Query(..., description="Starting point address or lat,lng"),
    destination: str = Query(..., description="Destination address or lat,lng"),
    mode: str = Query("driving", description="driving, walking, bicycling, transit"),
    waypoints: Optional[str] = Query(None, description="Pipe or comma separated list of waypoint stops"),
):
    """
    Get detailed route directions with total distance, duration, overview polyline, and turn-by-turn steps.
    """
    try:
        waypoint_list = [w.strip() for w in waypoints.split("|") if w.strip()] if waypoints else None
        return await maps_client.get_directions(
            origin=origin,
            destination=destination,
            mode=mode,
            waypoints=waypoint_list,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Routing failed: {str(exc)}")


@router.get("/geocode")
async def geocode(address: str = Query(...)):
    """Geocode an address string to coordinates."""
    try:
        res = await maps_client.geocode_address(address)
        if res:
            return {"status": "OK", "results": [res.dict()]}
    except Exception:
        pass

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.MAPS_BASE_URL}/geocode/json",
            params={"address": address, "key": settings.GOOGLE_MAPS_API_KEY or settings.MAPS_API_KEY},
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()


@router.get("/reverse-geocode")
async def reverse_geocode(lat: float, lng: float):
    """Reverse geocode coordinates to an address."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.MAPS_BASE_URL}/geocode/json",
            params={"latlng": f"{lat},{lng}", "key": settings.GOOGLE_MAPS_API_KEY or settings.MAPS_API_KEY},
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()


@router.get("/directions")
async def get_directions(
    origin: str = Query(...),
    destination: str = Query(...),
    mode: str = "driving",
    waypoints: Optional[str] = None,
):
    """Raw directions proxy for Google Directions API."""
    params = {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "key": settings.GOOGLE_MAPS_API_KEY or settings.MAPS_API_KEY,
    }
    if waypoints:
        params["waypoints"] = waypoints

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.MAPS_BASE_URL}/directions/json",
            params=params,
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()


@router.get("/nearby")
async def nearby_search(
    lat: float,
    lng: float,
    radius: int = 5000,
    place_type: str = "tourist_attraction",
):
    """Raw nearby search proxy."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.MAPS_BASE_URL}/place/nearbysearch/json",
            params={
                "location": f"{lat},{lng}",
                "radius": radius,
                "type": place_type,
                "key": settings.GOOGLE_PLACES_API_KEY or settings.MAPS_API_KEY,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()
