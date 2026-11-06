"""Search API — unified database search, categorized multi-provider search, and SerpApi live web search."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import structlog

from app.db.database import get_db
from app.models.models import Destination, Attraction, Hotel, Restaurant
from app.services.live_search_service import live_search_service
from app.services.places_service import places_service
from app.integrations.google_places_client import NormalizedPlace

router = APIRouter()
log = structlog.get_logger()


class WebSearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str
    source: str
    image_url: Optional[str] = None
    position: int
    category: str
    retrieved_at: str


class WebSearchResponse(BaseModel):
    query: str
    results: List[WebSearchResultItem]
    source: str = "serpapi"
    cached: bool = False
    engine: str = "google"
    live_search_available: bool = True
    error: Optional[str] = None


@router.get("")
async def search(
    q: str = Query(..., min_length=2, max_length=250),
    types: Optional[str] = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Unified search across destinations, attractions, hotels, restaurants."""
    results = []
    search_types = types.split(",") if types else ["destination", "attraction", "hotel", "restaurant"]

    try:
        if "destination" in search_types:
            dest_result = await db.execute(
                select(Destination)
                .where(
                    Destination.deleted_at.is_(None),
                    or_(
                        Destination.name.ilike(f"%{q}%"),
                        Destination.country.ilike(f"%{q}%"),
                        Destination.description.ilike(f"%{q}%"),
                    ),
                )
                .limit(limit)
            )
            for d in dest_result.scalars().all():
                results.append({
                    "type": "destination",
                    "id": str(d.id),
                    "name": d.name,
                    "subtitle": d.country,
                    "image_url": d.hero_image_url,
                    "slug": d.slug,
                    "avg_rating": d.avg_rating,
                })

        if "attraction" in search_types:
            att_result = await db.execute(
                select(Attraction)
                .where(Attraction.name.ilike(f"%{q}%"))
                .limit(limit)
            )
            for a in att_result.scalars().all():
                results.append({
                    "type": "attraction",
                    "id": str(a.id),
                    "name": a.name,
                    "subtitle": a.category,
                    "image_url": a.image_url,
                    "avg_rating": a.avg_rating,
                })
    except Exception as e:
        log.warning("db_search_fallback", error=str(e))

    # Also search through places_service if internal DB returned few results
    if len(results) < limit:
        try:
            places = await places_service.search_places(query=q, limit=limit, db=db)
            for p in places:
                results.append({
                    "type": p.category,
                    "id": p.id,
                    "name": p.name,
                    "subtitle": p.city or p.address,
                    "image_url": p.image_url,
                    "avg_rating": p.rating,
                    "source": p.source,
                })
        except Exception as e:
            log.warning("places_search_fallback", error=str(e))

    return {"results": results[:limit * len(search_types)], "query": q}


@router.get("/destinations", response_model=List[NormalizedPlace])
async def search_destinations(
    q: str = Query("", description="Destination query"),
    city: Optional[str] = Query(None, description="City name"),
    country: Optional[str] = Query(None, description="Country"),
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search destinations across Google Places, local catalog, and SerpApi."""
    query = q or (f"{city} {country}".strip() if (city or country) else "top travel destinations")
    return await places_service.search_places(
        query=query,
        category="destination",
        city=city,
        country=country,
        limit=limit,
        db=db,
    )


@router.get("/attractions", response_model=List[NormalizedPlace])
async def search_attractions(
    q: str = Query("", description="Attraction query"),
    city: Optional[str] = Query(None, description="City name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    open_now: bool = Query(False),
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search tourist attractions, monuments, museums, and sightseeing spots."""
    query = q or (f"top attractions in {city}" if city else "tourist attractions")
    return await places_service.search_places(
        query=query,
        category="attraction",
        city=city,
        lat=lat,
        lng=lng,
        min_rating=min_rating,
        open_now=open_now,
        limit=limit,
        db=db,
    )


@router.get("/restaurants", response_model=List[NormalizedPlace])
async def search_restaurants(
    q: str = Query("", description="Restaurant query or cuisine"),
    city: Optional[str] = Query(None, description="City name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    price_level: Optional[int] = Query(None, ge=1, le=4),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    open_now: bool = Query(False),
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search restaurants, cafes, rooftop dining, and street food."""
    query = q or (f"best restaurants dining in {city}" if city else "restaurants")
    return await places_service.search_places(
        query=query,
        category="restaurant",
        city=city,
        lat=lat,
        lng=lng,
        price_level=price_level,
        min_rating=min_rating,
        open_now=open_now,
        limit=limit,
        db=db,
    )


@router.get("/hotels")
async def search_hotels(
    query: Optional[str] = Query(None, description="Free-text search for hotels"),
    q: Optional[str] = Query(None, description="Alternative query param"),
    city: Optional[str] = Query(None, description="City name"),
    country: Optional[str] = Query(None, description="Country name"),
    min_price: Optional[float] = Query(None, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, description="Maximum price filter"),
    min_rating: Optional[float] = Query(None, description="Minimum average rating"),
    min_review_count: Optional[int] = Query(None, description="Minimum review count"),
    amenity: Optional[str] = Query(None, description="Required amenity"),
    sort: Optional[str] = Query("rating_desc", description="Sort order"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Search hotels in the catalog by name, city, country, continent, rating, review count,
    price when available, and amenities. Missing prices display as 'Price unavailable'.
    """
    from app.api.hotels import search_hotels_query
    search_term = query or q
    return await search_hotels_query(
        db=db,
        query=search_term,
        city=city,
        country=country,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        min_review_count=min_review_count,
        amenity=amenity,
        sort=sort,
        page=page,
        limit=limit,
    )


@router.get("/activities", response_model=List[NormalizedPlace])
async def search_activities(
    q: str = Query("", description="Activity query"),
    city: Optional[str] = Query(None, description="City name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search tours, outdoor adventures, cooking classes, and water sports."""
    query = q or (f"outdoor activities tours in {city}" if city else "activities")
    return await places_service.search_places(
        query=query,
        category="activity",
        city=city,
        lat=lat,
        lng=lng,
        limit=limit,
        db=db,
    )


@router.get("/live", response_model=WebSearchResponse)
async def search_live(
    q: str = Query(..., min_length=2, max_length=250, description="Live search query"),
    location: Optional[str] = Query(None, description="Geographic location context"),
    category: Optional[str] = Query("general", description="Category: destination, attraction, hotel, restaurant, activity, event"),
    limit: int = Query(10, ge=1, le=20),
):
    """
    Live real-time search across Google Maps local results and web travel content via SerpApi.
    """
    try:
        response = await live_search_service.search_web(
            query=q,
            location=location,
            category=category or "general",
            num_results=limit,
        )
        return WebSearchResponse(
            query=response.query,
            results=[WebSearchResultItem(**r.model_dump()) for r in response.results],
            source=response.source,
            cached=response.cached,
            engine=response.engine,
            live_search_available=response.live_search_available,
            error=response.error,
        )
    except Exception as exc:
        log.error("search_live_error", error=str(exc))
        return WebSearchResponse(
            query=q,
            results=[],
            source="serpapi",
            cached=False,
            live_search_available=False,
            error="Live search temporarily unavailable",
        )


@router.get("/web", response_model=WebSearchResponse)
async def search_web(
    q: str = Query(..., min_length=2, max_length=250, description="Search query"),
    location: Optional[str] = Query(None, description="Geographic location (e.g. India, Kyoto)"),
    category: Optional[str] = Query("general", description="Domain category: destination, attraction, hotel, restaurant, activity, event, guide"),
    language: str = Query("en", description="Search language"),
    country: str = Query("in", description="Search country code"),
    limit: int = Query(10, ge=1, le=20, description="Max results limit"),
):
    """
    Live web search endpoint powered by SerpApi.
    Supports destinations, attractions, hotels, restaurants, activities, guides, and events.
    Includes Redis caching, deduplication, and normalized response schema.
    """
    try:
        response = await live_search_service.search_web(
            query=q,
            location=location,
            language=language,
            country=country,
            num_results=limit,
            category=category or "general",
        )
        return WebSearchResponse(
            query=response.query,
            results=[WebSearchResultItem(**r.model_dump()) for r in response.results],
            source=response.source,
            cached=response.cached,
            engine=response.engine,
            live_search_available=response.live_search_available,
            error=response.error,
        )
    except Exception as exc:
        log.error("search_web_unhandled_error", error=str(exc))
        return WebSearchResponse(
            query=q,
            results=[],
            source="serpapi",
            cached=False,
            live_search_available=False,
            error="Live search temporarily unavailable",
        )
