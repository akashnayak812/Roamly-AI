"""
Hotels API — catalog search, filtering, recommendations, nearby queries, comparison, and live enrichment.
"""
from __future__ import annotations
import math
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, desc, asc
from pydantic import BaseModel
import structlog

from app.db.database import get_db
from app.models.models import Hotel
from app.services.hotel_recommendation_service import (
    hotel_recommendation_service,
    HotelRecommendationInput,
)
from app.services.hotel_enrichment_service import hotel_enrichment_service
from app.integrations.amadeus_client import amadeus_client, AmadeusResponse

router = APIRouter()
log = structlog.get_logger()


def format_hotel_payload(h: Hotel) -> Dict[str, Any]:
    """Serialize a Hotel model into the normalized client schema."""
    p_min = h.price_per_night_min
    p_max = h.price_per_night_max

    price_display = f"${p_min:.2f}" if p_min is not None else "Price unavailable"

    return {
        "id": h.id,
        "name": h.name,
        "description": h.description,
        "category": h.category,
        "city": h.city,
        "country": h.country,
        "continent": h.continent,
        "destination_slug": h.destination_slug,
        "destination_id": str(h.destination_id) if h.destination_id else None,
        "star_rating": h.star_rating,
        "avg_guest_rating": h.avg_guest_rating,
        "review_count": h.review_count or 0,
        "image_url": h.image_url,
        "gallery_images": list(h.gallery_images or []),
        "latitude": h.latitude,
        "longitude": h.longitude,
        "address": h.address,
        "price_per_night_min": p_min,
        "price_per_night_max": p_max,
        "price_currency": h.price_currency,
        "price_display": price_display,
        "amenities": list(h.amenities or []),
        "is_pet_friendly": h.is_pet_friendly,
        "is_family_friendly": h.is_family_friendly,
        "has_pool": bool(h.has_pool),
        "has_spa": bool(h.has_spa),
        "booking_url": h.booking_url,
        "source": h.source or "hotels.csv",
        "source_row": h.source_row,
        "is_live_data": bool(h.is_live_data),
        "data_quality_flags": list(h.data_quality_flags or []),
        "static_price": h.static_price or p_min,
        "live_price": h.live_price,
        "live_currency": h.live_currency,
        "availability_status": h.availability_status or ("Live offer" if h.is_live_data else "From dataset"),
        "live_provider": h.live_provider,
        "live_retrieved_at": h.live_retrieved_at.isoformat() if h.live_retrieved_at else None,
        "created_at": h.created_at.isoformat() if h.created_at else None,
        "updated_at": h.updated_at.isoformat() if h.updated_at else None,
    }


async def search_hotels_query(
    db: AsyncSession,
    query: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    min_review_count: Optional[int] = None,
    amenity: Optional[str] = None,
    sort: Optional[str] = "rating_desc",
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    """Core search & filter query handler for hotels catalog."""
    stmt = select(Hotel)
    conditions = []

    if query and query.strip():
        q_term = f"%{query.strip()}%"
        conditions.append(
            or_(
                Hotel.name.ilike(q_term),
                Hotel.city.ilike(q_term),
                Hotel.country.ilike(q_term),
                Hotel.continent.ilike(q_term),
                Hotel.destination_slug.ilike(q_term),
                Hotel.address.ilike(q_term),
            )
        )

    if city and city.strip():
        conditions.append(Hotel.city.ilike(f"%{city.strip()}%"))

    if country and country.strip():
        conditions.append(Hotel.country.ilike(f"%{country.strip()}%"))

    if min_price is not None:
        conditions.append(Hotel.price_per_night_min >= min_price)

    if max_price is not None:
        # Match only hotels with price within limit (or explicit null if not strictly price filtered)
        conditions.append(Hotel.price_per_night_min <= max_price)

    if min_rating is not None:
        conditions.append(Hotel.avg_guest_rating >= min_rating)

    if min_review_count is not None:
        conditions.append(Hotel.review_count >= min_review_count)

    if amenity and amenity.strip():
        a_term = amenity.strip().lower()
        if a_term in ["pool", "swimming pool"]:
            conditions.append(Hotel.has_pool.is_(True))
        elif a_term in ["spa"]:
            conditions.append(Hotel.has_spa.is_(True))
        else:
            # Check JSONB array of amenities
            conditions.append(Hotel.amenities.contains([amenity.strip()]))

    if conditions:
        stmt = stmt.where(and_(*conditions))

    # Calculate total count
    count_stmt = select(func.count(Hotel.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total_count = (await db.execute(count_stmt)).scalar() or 0

    # Sorting
    if sort == "price_asc":
        stmt = stmt.order_by(Hotel.price_per_night_min.asc().nullslast())
    elif sort == "price_desc":
        stmt = stmt.order_by(Hotel.price_per_night_min.desc().nullslast())
    elif sort == "reviews_desc":
        stmt = stmt.order_by(Hotel.review_count.desc())
    elif sort == "name_asc":
        stmt = stmt.order_by(Hotel.name.asc())
    else:  # rating_desc (default)
        stmt = stmt.order_by(Hotel.avg_guest_rating.desc().nullslast(), Hotel.review_count.desc())

    # Pagination
    offset = max(page - 1, 0) * limit
    stmt = stmt.offset(offset).limit(limit)

    results = (await db.execute(stmt)).scalars().all()
    pages = math.ceil(total_count / limit) if limit > 0 else 1

    return {
        "items": [format_hotel_payload(h) for h in results],
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


@router.get("")
async def list_hotels(
    query: Optional[str] = Query(None, description="Free text search on hotel name, city, country"),
    city: Optional[str] = Query(None, description="City filter"),
    country: Optional[str] = Query(None, description="Country filter"),
    min_price: Optional[float] = Query(None, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, description="Maximum price filter"),
    min_rating: Optional[float] = Query(None, description="Minimum average rating (e.g. 4.0)"),
    min_review_count: Optional[int] = Query(None, description="Minimum review count"),
    amenity: Optional[str] = Query(None, description="Required amenity (e.g. Free WiFi, Pool)"),
    sort: Optional[str] = Query("rating_desc", description="Sort order"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search and filter the 59,707 hotel dataset catalog."""
    return await search_hotels_query(
        db=db,
        query=query,
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


@router.get("/recommendations")
async def get_hotel_recommendations(
    destination: Optional[str] = Query(None, description="Destination name or city"),
    city: Optional[str] = Query(None, description="Target city"),
    country: Optional[str] = Query(None, description="Target country"),
    budget: Optional[float] = Query(None, description="Nightly budget limit"),
    travelers: int = Query(1, ge=1, le=10),
    travel_style: Optional[str] = Query(None, description="luxury, budget, relaxed, family, romantic"),
    amenities: Optional[str] = Query(None, description="Comma-separated preferred amenities"),
    min_rating: Optional[float] = Query(None, description="Minimum rating filter"),
    saved_hotels: Optional[str] = Query(None, description="Comma-separated saved hotel IDs"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Personalized baseline hotel recommendation endpoint.
    Computes transparent multi-factor score: destination, rating, review confidence, budget, amenity, and preference match.
    """
    pref_amenities = [a.strip() for a in amenities.split(",") if a.strip()] if amenities else []
    saved_list = [s.strip() for s in saved_hotels.split(",") if s.strip()] if saved_hotels else []

    inputs = HotelRecommendationInput(
        destination=destination,
        city=city,
        country=country,
        budget=budget,
        travelers=travelers,
        travel_style=travel_style,
        preferred_amenities=pref_amenities,
        min_rating=min_rating,
        saved_hotels=saved_list,
    )

    recommended = await hotel_recommendation_service.recommend(db=db, inputs=inputs, limit=limit)
    return {
        "destination": destination or city,
        "recommendations": recommended,
        "total": len(recommended),
    }


@router.get("/nearby")
async def get_nearby_hotels(
    latitude: Optional[float] = Query(None, description="Latitude"),
    longitude: Optional[float] = Query(None, description="Longitude"),
    city: Optional[str] = Query(None, description="City fallback when coordinates missing"),
    country: Optional[str] = Query(None, description="Country fallback"),
    radius_km: float = Query(25.0, ge=1.0, le=200.0),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve hotels near specified geographical coordinates or city.
    Gracefully falls back to city matching when dataset coordinates are unavailable.
    """
    if latitude is not None and longitude is not None:
        # Haversine distance in SQL if hotel coordinates exist
        raw_sql = text("""
            SELECT id, name, city, country, avg_guest_rating, review_count, price_per_night_min,
                   (6371 * acos(cos(radians(:lat)) * cos(radians(latitude)) *
                   cos(radians(longitude) - radians(:lon)) +
                   sin(radians(:lat)) * sin(radians(latitude)))) AS distance_km
            FROM hotels
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY distance_km ASC
            LIMIT :lim
        """)
        try:
            res = await db.execute(raw_sql, {"lat": latitude, "lon": longitude, "lim": limit})
            rows = res.fetchall()
            if rows:
                ids = [r[0] for r in rows]
                hotels_stmt = select(Hotel).where(Hotel.id.in_(ids))
                hotels_res = (await db.execute(hotels_stmt)).scalars().all()
                hotels_map = {h.id: h for h in hotels_res}
                return {
                    "method": "coordinates",
                    "items": [format_hotel_payload(hotels_map[r[0]]) for r in rows if r[0] in hotels_map],
                }
        except Exception as e:
            log.warning("coordinates_nearby_failed", error=str(e))

    # Fallback to city/country lookup
    if city or country:
        search_res = await search_hotels_query(db=db, city=city, country=country, limit=limit)
        return {
            "method": "city_fallback",
            "items": search_res["items"],
            "total": search_res["total"],
        }

    # Default top rated hotels
    default_res = await search_hotels_query(db=db, sort="rating_desc", limit=limit)
    return {
        "method": "top_rated_fallback",
        "items": default_res["items"],
        "total": default_res["total"],
    }


@router.get("/compare")
async def compare_hotels(
    hotel_ids: str = Query(..., description="Comma-separated hotel IDs to compare (2 to 5 IDs)"),
    db: AsyncSession = Depends(get_db),
):
    """Side-by-side comparison matrix of selected hotels."""
    ids = [i.strip() for i in hotel_ids.split(",") if i.strip()][:5]
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 hotel IDs for comparison")

    result = await db.execute(select(Hotel).where(Hotel.id.in_(ids)))
    hotels = result.scalars().all()

    if not hotels:
        raise HTTPException(status_code=404, detail="No matching hotels found")

    hotels_formatted = [format_hotel_payload(h) for h in hotels]

    # Build attribute comparison matrix
    all_amenities = sorted(list(set(
        amenity
        for h in hotels_formatted
        for amenity in (h.get("amenities") or [])
    )))

    return {
        "hotels": hotels_formatted,
        "comparison_matrix": {
            "amenities_list": all_amenities,
            "ratings": {h["id"]: h["avg_guest_rating"] for h in hotels_formatted},
            "reviews": {h["id"]: h["review_count"] for h in hotels_formatted},
            "prices": {h["id"]: h["price_display"] for h in hotels_formatted},
            "has_pool": {h["id"]: h["has_pool"] for h in hotels_formatted},
            "has_spa": {h["id"]: h["has_spa"] for h in hotels_formatted},
            "family_friendly": {h["id"]: h["is_family_friendly"] for h in hotels_formatted},
            "pet_friendly": {h["id"]: h["is_pet_friendly"] for h in hotels_formatted},
        },
    }


@router.get("/{hotel_id}")
async def get_hotel_details(
    hotel_id: str,
    enrich: bool = Query(False, description="Whether to trigger live API enrichment"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full hotel details by stable dataset ID with optional live enrichment."""
    result = await db.execute(select(Hotel).where(Hotel.id == hotel_id))
    hotel = result.scalar_one_or_none()

    if not hotel:
        raise HTTPException(status_code=404, detail=f"Hotel '{hotel_id}' not found")

    if enrich:
        enriched = await hotel_enrichment_service.enrich_hotel_record(hotel, db=db)
        return enriched

    return format_hotel_payload(hotel)


@router.post("/{hotel_id}/enrich")
async def enrich_hotel_endpoint(
    hotel_id: str,
    check_in: Optional[str] = Query(None),
    check_out: Optional[str] = Query(None),
    adults: int = Query(2, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly enrich a hotel with live rates, inventory, and photos."""
    result = await db.execute(select(Hotel).where(Hotel.id == hotel_id))
    hotel = result.scalar_one_or_none()

    if not hotel:
        raise HTTPException(status_code=404, detail=f"Hotel '{hotel_id}' not found")

    enriched = await hotel_enrichment_service.enrich_hotel_record(
        hotel,
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        db=db,
    )
    return enriched


@router.get("/offers", response_model=AmadeusResponse)
async def get_hotel_offers(
    city: str = Query(..., min_length=2, description="City name or IATA code"),
    check_in: Optional[str] = Query(None, description="Check-in date (YYYY-MM-DD)"),
    check_out: Optional[str] = Query(None, description="Check-out date (YYYY-MM-DD)"),
    adults: int = Query(2, ge=1, le=9, description="Number of adult guests"),
    room_quantity: int = Query(1, ge=1, le=5, description="Number of rooms"),
    price_max: Optional[float] = Query(None, description="Max total price filter"),
    limit: int = Query(10, ge=1, le=30, description="Max results count"),
):
    """Legacy Amadeus hotel offers proxy."""
    try:
        response = await amadeus_client.search_hotel_offers(
            city_code_or_name=city,
            check_in_date=check_in,
            check_out_date=check_out,
            adults=adults,
            room_quantity=room_quantity,
            price_max=price_max,
        )
        if response.offers and len(response.offers) > limit:
            response.offers = response.offers[:limit]
        return response
    except Exception as exc:
        log.error("hotel_offers_error", city=city, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch hotel offers")
