"""
Destinations API — search, filter, details, recommendations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List
import structlog

from app.db.database import get_db
from app.core.deps import get_optional_user, get_current_user
from app.models.models import User, Destination, Attraction, Hotel, Restaurant, Review
from app.rag.retrieval import rag_pipeline

router = APIRouter()
log = structlog.get_logger()


def destination_to_dict(dest: Destination) -> dict:
    return {
        "id": str(dest.id),
        "slug": dest.slug,
        "name": dest.name,
        "country": dest.country,
        "state": dest.state,
        "city": dest.city,
        "region": dest.region,
        "continent": dest.continent,
        "latitude": dest.latitude,
        "longitude": dest.longitude,
        "description": dest.description,
        "ai_summary": dest.ai_summary,
        "hero_image_url": dest.hero_image_url,
        "gallery_images": dest.gallery_images or [],
        "categories": dest.categories or [],
        "tags": dest.tags or [],
        "best_time_to_visit": dest.best_time_to_visit,
        "climate_type": dest.climate_type,
        "avg_rating": dest.avg_rating,
        "review_count": dest.review_count,
        "safety_score": dest.safety_score,
        "popularity_score": dest.popularity_score,
        "avg_daily_cost_min": dest.avg_daily_cost_min,
        "avg_daily_cost_max": dest.avg_daily_cost_max,
        "cost_currency": dest.cost_currency,
        "crowd_level": dest.crowd_level,
        "is_hidden_gem": dest.is_hidden_gem,
        "is_family_friendly": dest.is_family_friendly,
        "is_romantic": dest.is_romantic,
    }


@router.get("")
async def list_destinations(
    q: Optional[str] = Query(None, description="Search query"),
    country: Optional[str] = None,
    region: Optional[str] = None,
    category: Optional[str] = None,
    budget_min: Optional[float] = None,
    budget_max: Optional[float] = None,
    rating_min: Optional[float] = None,
    family_friendly: Optional[bool] = None,
    romantic: Optional[bool] = None,
    hidden_gem: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    query = select(Destination).where(Destination.deleted_at.is_(None))

    if q:
        query = query.where(
            or_(
                Destination.name.ilike(f"%{q}%"),
                Destination.country.ilike(f"%{q}%"),
                Destination.description.ilike(f"%{q}%"),
            )
        )
    if country:
        query = query.where(Destination.country.ilike(f"%{country}%"))
    if region:
        query = query.where(Destination.region.ilike(f"%{region}%"))
    if category:
        query = query.where(Destination.categories.contains([category]))
    if budget_min is not None:
        query = query.where(Destination.avg_daily_cost_min >= budget_min)
    if budget_max is not None:
        query = query.where(Destination.avg_daily_cost_max <= budget_max)
    if rating_min is not None:
        query = query.where(Destination.avg_rating >= rating_min)
    if family_friendly is not None:
        query = query.where(Destination.is_family_friendly == family_friendly)
    if romantic is not None:
        query = query.where(Destination.is_romantic == romantic)
    if hidden_gem is not None:
        query = query.where(Destination.is_hidden_gem == hidden_gem)

    # Count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    # Paginate
    query = query.order_by(Destination.popularity_score.desc().nullslast(), Destination.avg_rating.desc().nullslast())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    destinations = result.scalars().all()

    return {
        "items": [destination_to_dict(d) for d in destinations],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get("/popular")
async def get_popular_destinations(
    limit: int = 8,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Destination)
        .where(Destination.deleted_at.is_(None))
        .order_by(Destination.popularity_score.desc().nullslast())
        .limit(limit)
    )
    destinations = result.scalars().all()
    return [destination_to_dict(d) for d in destinations]


@router.get("/{slug}")
async def get_destination(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(
        select(Destination).where(Destination.slug == slug, Destination.deleted_at.is_(None))
    )
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    # Get top attractions
    attractions_result = await db.execute(
        select(Attraction)
        .where(Attraction.destination_id == dest.id)
        .order_by(Attraction.avg_rating.desc().nullslast())
        .limit(9)
    )
    attractions = [
        {
            "id": str(a.id),
            "name": a.name,
            "description": a.description,
            "category": a.category,
            "tags": a.tags or [],
            "image_url": a.image_url,
            "avg_rating": a.avg_rating,
            "review_count": a.review_count,
            "avg_duration_hours": a.avg_duration_hours,
            "estimated_cost": a.estimated_cost,
            "distance_from_center_km": a.distance_from_center_km,
            "is_free": a.is_free,
            "latitude": a.latitude,
            "longitude": a.longitude,
        }
        for a in attractions_result.scalars().all()
    ]

    # Get hotels
    hotels_result = await db.execute(
        select(Hotel)
        .where(Hotel.destination_id == dest.id)
        .order_by(Hotel.avg_guest_rating.desc().nullslast())
        .limit(6)
    )
    hotels = [
        {
            "id": str(h.id),
            "name": h.name,
            "description": h.description,
            "star_rating": h.star_rating,
            "avg_guest_rating": h.avg_guest_rating,
            "image_url": h.image_url,
            "price_per_night_min": h.price_per_night_min,
            "price_per_night_max": h.price_per_night_max,
            "price_currency": h.price_currency,
            "amenities": h.amenities or [],
            "latitude": h.latitude,
            "longitude": h.longitude,
        }
        for h in hotels_result.scalars().all()
    ]

    # Get restaurants
    restaurants_result = await db.execute(
        select(Restaurant)
        .where(Restaurant.destination_id == dest.id)
        .order_by(Restaurant.avg_rating.desc().nullslast())
        .limit(6)
    )
    restaurants = [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description,
            "cuisine_types": r.cuisine_types or [],
            "avg_rating": r.avg_rating,
            "image_url": r.image_url,
            "price_range": r.price_range,
            "avg_meal_cost": r.avg_meal_cost,
            "latitude": r.latitude,
            "longitude": r.longitude,
        }
        for r in restaurants_result.scalars().all()
    ]

    # Get reviews
    reviews_result = await db.execute(
        select(Review)
        .where(Review.destination_id == dest.id, Review.deleted_at.is_(None))
        .order_by(Review.rating.desc())
        .limit(10)
    )
    reviews = [
        {
            "id": str(r.id),
            "text": r.text,
            "rating": r.rating,
            "author_name": r.author_name,
            "sentiment": r.sentiment,
            "aspect_sentiments": r.aspect_sentiments,
        }
        for r in reviews_result.scalars().all()
    ]

    data = destination_to_dict(dest)
    data.update({
        "attractions": attractions,
        "hotels": hotels,
        "restaurants": restaurants,
        "reviews": reviews,
    })
    return data


@router.get("/{destination_id}/recommendations")
async def get_similar_destinations(
    destination_id: str,
    limit: int = 4,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Destination)
        .where(Destination.deleted_at.is_(None), Destination.id != destination_id)
        .order_by(Destination.popularity_score.desc().nullslast())
        .limit(limit)
    )
    return [destination_to_dict(d) for d in result.scalars().all()]
